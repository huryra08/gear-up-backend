import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { reviewService } from "./review.service";

const createReview = catchAsync(async (req, res) => {
    const result = await reviewService.createReview(req.user!.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Review submitted successfully",
        data: result,
    });
});

const getReviewsForGear = catchAsync(async (req, res) => {
    const result = await reviewService.getReviewsForGear(req.params.gearId as string);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Reviews retrieved successfully",
        data: result,
    });
});

export const reviewController = {
    createReview,
    getReviewsForGear,
};
