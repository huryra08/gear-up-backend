import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { userService } from "./user.service";
import { Role } from "../../../generated/prisma/enums";

const getAllUsers = catchAsync(async (req, res) => {
    const { role, searchTerm } = req.query;

    const result = await userService.getAllUsers({
        role: role as Role | undefined,
        searchTerm: searchTerm as string | undefined,
    });

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Users retrieved successfully",
        data: result,
    });
});

const updateUserStatus = catchAsync(async (req, res) => {
    const result = await userService.updateUserStatus(req.params.id as string, req.body.activeStatus);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "User status updated successfully",
        data: result,
    });
});

const updateMyProfile = catchAsync(async (req, res) => {
    const result = await userService.updateProfile(req.user!.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Profile updated successfully",
        data: result,
    });
});

export const userController = {
    getAllUsers,
    updateUserStatus,
    updateMyProfile,
};
