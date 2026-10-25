import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { jwtUtils } from "../../utils/jwt";
import config from "../../config";
import { Role } from "../../../generated/prisma/enums";
import { performance } from "node:perf_hooks";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

const createTokens = (user: { id: string; email: string; name: string; role: Role }) => {
    const jwtPayload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
    };

    const accessToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_access_secret,
        config.jwt_access_expires_in
    );

    const refreshToken = jwtUtils.createToken(
        jwtPayload,
        config.jwt_refresh_secret,
        config.jwt_refresh_expires_in
    );

    return { accessToken, refreshToken };
};

const registerUser = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: Role;
}) => {
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });

    if (existingUser) {
        throw new ApiError(httpStatus.CONFLICT, "A user with this email already exists");
    }

    if (payload.role && payload.role === "ADMIN") {
        throw new ApiError(httpStatus.FORBIDDEN, "You cannot register as an admin");
    }

    const hashedPassword = await bcrypt.hash(
        payload.password,
        Number(config.bcrypt_salt_rounds) || 10
    );

    const user = await prisma.user.create({
        data: {
            name: payload.name,
            email: payload.email,
            password: hashedPassword,
            phone: payload.phone,
            role: payload.role ?? "CUSTOMER",
        },
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

const loginUser = async (payload: { email: string; password: string }) => {
    const startedAt = performance.now();
    const timings: Record<string, number> = {};

    try {
        const lookupStartedAt = performance.now();
        const user = await prisma.user.findUnique({ where: { email: payload.email } });
        timings.userLookupMs = Math.round(performance.now() - lookupStartedAt);

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "No account found with this email");
        }

        if (user.activeStatus === "BLOCKED") {
            throw new ApiError(httpStatus.FORBIDDEN, "Your account is blocked, please contact support");
        }

        const passwordCheckStartedAt = performance.now();
        const isPasswordValid = await bcrypt.compare(payload.password, user.password);
        timings.passwordCheckMs = Math.round(performance.now() - passwordCheckStartedAt);

        if (!isPasswordValid) {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect password");
        }

        const tokenCreationStartedAt = performance.now();
        const { accessToken, refreshToken } = createTokens(user);

        timings.tokenCreationMs = Math.round(performance.now() - tokenCreationStartedAt);

        const { password, ...userWithoutPassword } = user;

        return { accessToken, refreshToken, user: userWithoutPassword };
    } finally {
        console.info("Login timing", {
            ...timings,
            totalMs: Math.round(performance.now() - startedAt),
        });
    }
};

const googleLogin = async (payload: {
    idToken?: string;
    credential?: string;
    accessToken?: string;
    access_token?: string;
}) => {
    const idToken = (
        typeof payload?.idToken === "string"
            ? payload.idToken
            : typeof payload?.credential === "string"
                ? payload.credential
                : undefined
    )?.trim();
    const googleAccessToken = (
        typeof payload?.accessToken === "string"
            ? payload.accessToken
            : typeof payload?.access_token === "string"
                ? payload.access_token
                : undefined
    )?.trim();

    if (!idToken && !googleAccessToken) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            "A Google ID token or access token is required"
        );
    }

    if (!config.google_client_id) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Google login is not configured");
    }

    let googlePayload: {
        sub?: string;
        email?: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
    };

    if (idToken) {
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: config.google_client_id,
            });
            const verifiedPayload = ticket.getPayload();
            if (!verifiedPayload) {
                throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
            }
            googlePayload = verifiedPayload;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            throw new ApiError(
                httpStatus.UNAUTHORIZED,
                "Invalid Google ID token. Ensure it was issued for the configured GOOGLE_CLIENT_ID"
            );
        }
    } else {
        if (!googleAccessToken) {
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                "A Google ID token or access token is required"
            );
        }

        let tokenInfo;
        try {
            tokenInfo = await googleClient.getTokenInfo(googleAccessToken);
        } catch {
            throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or expired Google access token");
        }

        if (tokenInfo.aud !== config.google_client_id) {
            throw new ApiError(
                httpStatus.UNAUTHORIZED,
                "Google access token was issued for a different client ID"
            );
        }

        googlePayload = {
            sub: tokenInfo.sub ?? tokenInfo.user_id,
            email: tokenInfo.email,
            email_verified: tokenInfo.email_verified,
        };
    }

    if (
        !googlePayload?.sub ||
        !googlePayload.email ||
        googlePayload.email_verified !== true
    ) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Google account email is not verified");
    }

    let user = await prisma.user.findUnique({
        where: { googleId: googlePayload.sub },
    });

    if (!user) {
        const existingUser = await prisma.user.findUnique({
            where: { email: googlePayload.email },
        });

        if (existingUser) {
            if (existingUser.googleId && existingUser.googleId !== googlePayload.sub) {
                throw new ApiError(httpStatus.CONFLICT, "This email is linked to another Google account");
            }

            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    googleId: googlePayload.sub,
                    authProvider: "GOOGLE",
                    image: googlePayload.picture ?? existingUser.image,
                },
            });
        } else {
            const password = await bcrypt.hash(
                randomBytes(32).toString("hex"),
                Number(config.bcrypt_salt_rounds) || 10
            );

            user = await prisma.user.create({
                data: {
                    name: googlePayload.name ?? googlePayload.email,
                    email: googlePayload.email,
                    password,
                    googleId: googlePayload.sub,
                    authProvider: "GOOGLE",
                    image: googlePayload.picture,
                },
            });
        }
    }

    if (user.activeStatus === "BLOCKED") {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is blocked, please contact support");
    }

    const { accessToken, refreshToken } = createTokens(user);
    const { password, ...userWithoutPassword } = user;

    return { accessToken, refreshToken, user: userWithoutPassword };
};

const getMe = async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        include: { profile: true },
    });

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

export const authService = {
    registerUser,
    loginUser,
    googleLogin,
    getMe,
};
