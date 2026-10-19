import { NextFunction, Request, RequestHandler, Response } from "express";
import httpStatus from "http-status";
import { ApiError } from "./apiError";

export const catchAsync = (fn: RequestHandler) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await fn(req, res, next);
        } catch (error) {
            console.log(error);

            const statusCode = error instanceof ApiError ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR;

            res.status(statusCode).json({
                success: false,
                statusCode,
                message: (error as Error).message || "Something went wrong",
                error: (error as Error).message
            })
        }
    }
}
