import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { rentalOrderService } from "./rentalOrder.service";

const createRentalOrder = catchAsync(async (req, res) => {
    const result = await rentalOrderService.createRentalOrder(req.user!.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Rental order created successfully",
        data: result,
    });
});

const getOrders = catchAsync(async (req, res) => {
    const { id, role } = req.user!;

    const result =
        role === "ADMIN"
            ? await rentalOrderService.getAllOrders()
            : role === "PROVIDER"
                ? await rentalOrderService.getProviderOrders(id)
                : await rentalOrderService.getMyOrders(id);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Rental orders retrieved successfully",
        data: result,
    });
});

const getOrderById = catchAsync(async (req, res) => {
    const result = await rentalOrderService.getOrderById(req.params.id as string, req.user!);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Rental order details retrieved successfully",
        data: result,
    });
});

const updateOrderStatus = catchAsync(async (req, res) => {
    const { id, role } = req.user!;
    const result = await rentalOrderService.updateOrderStatus(req.params.id as string, id, role, req.body.status);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Rental order status updated successfully",
        data: result,
    });
});

export const rentalOrderController = {
    createRentalOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
};
