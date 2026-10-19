import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

const createReview = async (
    customerId: string,
    payload: { gearId: string; rentalOrderId: string; rating: number; comment?: string }
) => {
    const { gearId, rentalOrderId, rating, comment } = payload;

    if (rating < 1 || rating > 5) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Rating must be between 1 and 5");
    }

    const order = await prisma.rentalOrder.findUnique({
        where: { id: rentalOrderId },
        include: { items: true },
    });

    if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, "Rental order not found");
    }

    if (order.customerId !== customerId) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only review your own rentals");
    }

    if (order.status !== "RETURNED") {
        throw new ApiError(httpStatus.BAD_REQUEST, "You can only leave a review after the gear has been returned");
    }

    const rentedThisGear = order.items.some((item) => item.gearId === gearId);
    if (!rentedThisGear) {
        throw new ApiError(httpStatus.BAD_REQUEST, "This gear was not part of the given rental order");
    }

    const existingReview = await prisma.review.findUnique({
        where: {
            customerId_gearId_rentalOrderId: { customerId, gearId, rentalOrderId },
        },
    });

    if (existingReview) {
        throw new ApiError(httpStatus.CONFLICT, "You have already reviewed this gear for this rental");
    }

    return prisma.review.create({
        data: { customerId, gearId, rentalOrderId, rating, comment },
    });
};

const getReviewsForGear = async (gearId: string) => {
    return prisma.review.findMany({
        where: { gearId },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
    });
};

export const reviewService = {
    createReview,
    getReviewsForGear,
};
