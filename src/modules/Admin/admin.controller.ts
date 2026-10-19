import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { adminService } from "./admin.service";
import { userService } from "../User/user.service";
import { NextFunction, Request, Response } from "express";

const getAllUsers = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const { role, searchTerm } = req.query;
    const result = await userService.getAllUsers({
        role: role as any,
        searchTerm: searchTerm as string | undefined,
    });

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Users retrieved successfully",
        data: result,
    });
});

const updateUserStatus = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const result = await userService.updateUserStatus(req.params.id as string, req.body.activeStatus);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "User status updated successfully",
        data: result,
    });
});

const getAllGear = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const result = await adminService.getAllGear();

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "All gear listings retrieved successfully",
        data: result,
    });
});

const getAllRentals = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const result = await adminService.getAllRentals();

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "All rental orders retrieved successfully",
        data: result,
    });
});

const getDashboardStats = catchAsync(async (req: Request, res:Response ,next :NextFunction) => {
    const result = await adminService.getDashboardStats();

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Dashboard stats retrieved successfully",
        data: result,
    });
});

export const adminController = {
    getAllUsers,
    updateUserStatus,
    getAllGear,
    getAllRentals,
    getDashboardStats,
};
