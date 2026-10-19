import httpStatus from "http-status";
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { analyticsService } from "./analytics.service";

const getAdminAnalytics = catchAsync(async (_req: Request, res: Response) => {
    const result = await analyticsService.getAdminAnalytics();
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Admin analytics retrieved successfully", data: result });
});

const getProviderAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await analyticsService.getProviderAnalytics(req.user!.id);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Provider analytics retrieved successfully", data: result });
});

const getCustomerAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await analyticsService.getCustomerAnalytics(req.user!.id);
    sendResponse(res, { success: true, statusCode: httpStatus.OK, message: "Customer analytics retrieved successfully", data: result });
});

export const analyticsController = {
    getAdminAnalytics,
    getProviderAnalytics,
    getCustomerAnalytics,
};