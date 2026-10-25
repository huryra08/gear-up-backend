import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { authService } from "./auth.service";
import { NextFunction, Request, Response } from "express";

const register = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const result = await authService.registerUser(req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "User registered successfully",
        data: {
            result
        }
    });
});

const login = catchAsync(async (req: Request, res:Response) => {
    const result = await authService.loginUser(req.body);

    setAuthCookies(res, result);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Logged in successfully",
        data: result,
    });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
    const result = await authService.googleLogin(req.body);

    setAuthCookies(res, result);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Logged in with Google successfully",
        data: result,
    });
});

const setAuthCookies = (
    res: Response,
    result: { accessToken: string; refreshToken: string }
) => {
    res.cookie("accessToken", result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    });
    res.cookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    });
};

const getMe = catchAsync(async (req: Request, res:Response) => {
    const result = await authService.getMe(req.user!.id);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Current user retrieved successfully",
        data: result,
    });
});

export const authController = {
    register,
    login,
    googleLogin,
    getMe,
};
