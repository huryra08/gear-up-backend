import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { categoryService } from "./category.service";

const createCategory = catchAsync(async (req, res) => {
    const result = await categoryService.createCategory(req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Category created successfully",
        data: result,
    });
});

const getAllCategories = catchAsync(async (req, res) => {
    const result = await categoryService.getAllCategories();

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Categories retrieved successfully",
        data: result,
    });
});

const updateCategory = catchAsync(async (req, res) => {
    const result = await categoryService.updateCategory(req.params.id as string, req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Category updated successfully",
        data: result,
    });
});

const deleteCategory = catchAsync(async (req, res) => {
    const result = await categoryService.deleteCategory(req.params.id as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Category deleted successfully",
        data: result,
    });
});

export const categoryController = {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory,
};
