import bcrypt from "bcrypt";
import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { jwtUtils } from "../../utils/jwt";
import config from "../../config";
import { Role } from "../../../generated/prisma/enums";

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
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, "No account found with this email");
    }

    if (user.activeStatus === "BLOCKED") {
        throw new ApiError(httpStatus.FORBIDDEN, "Your account is blocked, please contact support");
    }

    const isPasswordValid = await bcrypt.compare(payload.password, user.password);

    if (!isPasswordValid) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Incorrect password");
    }

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
    getMe,
};
