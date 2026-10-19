import { NextFunction, Request, Response } from "express";
import { Role } from "../../generated/prisma/enums";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";
import config from "../config";
import { JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/apiError";
import httpStatus from "http-status";

declare global {
    namespace Express {
        interface Request {
            user?: {
                email: string,
                name: string,
                id: string,
                role: Role
            }
        }
    }
}

export const auth = (...requiredRoles: Role[]) => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const token = req.cookies.accessToken
            ? req.cookies.accessToken
            : req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization?.split(" ")[1]
                : req.headers.authorization;

        if (!token) {
            throw new ApiError(httpStatus.UNAUTHORIZED, "You are not logged in. Please log in to access this resource");
        }

        const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

        if (!verifiedToken.success) {
            throw new ApiError(httpStatus.UNAUTHORIZED, verifiedToken.error as string);
        }

        const { email, name, id, role } = verifiedToken.data as JwtPayload;

        if (requiredRoles.length && !requiredRoles.includes(role as Role)) {
            throw new ApiError(httpStatus.FORBIDDEN, "Forbidden. You don't have permission to access this resource");
        }

        const user = await prisma.user.findUnique({
            where: {
                id,
                email,
                role: role as Role
            }
        });

        if (!user) {
            throw new ApiError(httpStatus.NOT_FOUND, "User not found. Please log in again");
        }

        if (user.activeStatus === "BLOCKED") {
            throw new ApiError(httpStatus.FORBIDDEN, "Your account is blocked, please contact support");
        }

        req.user = {
            email,
            name,
            id,
            role
        };

        next();
    });
};
