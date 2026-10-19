import httpStatus from "http-status";
import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { paymentService } from "./payment.service";
import config from "../../config";


const createPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await paymentService.createPayment(req.user!.id, req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.CREATED,
        message: "Payment session created successfully",
        data: result,
    });
});


const confirmPayment = catchAsync(async (req: Request, res: Response,next: NextFunction) => {
    const result = await paymentService.confirmPayment(req.body);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment confirmed successfully",
        data: result,
    });
});


const stripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
        res.status(httpStatus.BAD_REQUEST).json({ message: "Missing stripe-signature header" });
        return;
    }

    try {
        const result = await paymentService.handleStripeWebhook(
            req.body,                          
            signature,
            config.stripe_webhook_secret as string
        );
        res.status(httpStatus.OK).json(result);
    } catch (error: any) {
        console.error("Stripe webhook error:", error.message);
        res.status(httpStatus.BAD_REQUEST).json({ message: error.message });
    }
};


const sslSuccess = async (req: Request, res: Response,next: NextFunction) => {
    const { tran_id, val_id } = req.body;

    
    if (!tran_id || !val_id) {
        res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: "Missing tran_id or val_id. Send as x-www-form-urlencoded body.",
        });
        return;
    }

    try {
        await paymentService.confirmSSLCommerzPayment({ tran_id, val_id });
        res.redirect(`${config.app_url}/payment/success?transactionId=${tran_id}`);
    } catch (error: any) {
        console.error("SSLCommerz success handler error:", error.message);
        res.redirect(`${config.app_url}/payment/fail?transactionId=${tran_id}`);
    }
};


const sslFail = async (req: Request, res: Response,next: NextFunction) => {
    const { tran_id } = req.body;

    try {
        if (tran_id) await paymentService.markSSLCommerzPaymentFailed(tran_id);
    } catch (error: any) {
        console.error("SSLCommerz fail handler error:", error.message);
    }

    res.redirect(`${config.app_url}/payment/fail?transactionId=${tran_id ?? ""}`);
};


const sslCancel = async (req: Request, res: Response, next: NextFunction) => {
    const { tran_id } = req.body;

    try {
        if (tran_id) await paymentService.markSSLCommerzPaymentFailed(tran_id);
    } catch (error: any) {
        console.error("SSLCommerz cancel handler error:", error.message);
    }

    res.redirect(`${config.app_url}/payment/cancel?transactionId=${tran_id ?? ""}`);
};


const sslIPN = async (req: Request, res: Response, next: NextFunction) => {
    const { tran_id, val_id, status } = req.body;

    try {
        if (status === "VALID" || status === "VALIDATED") {
            await paymentService.confirmSSLCommerzPayment({ tran_id, val_id });
        } else {
            await paymentService.markSSLCommerzPaymentFailed(tran_id);
        }
        res.status(httpStatus.OK).json({ received: true });
    } catch (error: any) {
        console.error("SSLCommerz IPN error:", error.message);
        res.status(httpStatus.BAD_REQUEST).json({ received: false, message: error.message });
    }
};


const getMyPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await paymentService.getMyPayments(req.user!.id);

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment history retrieved successfully",
        data: result,
    });
});


const getPaymentById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const result = await paymentService.getPaymentById(
        req.params.id as string,
        req.user!.id,
        req.user!.role
    );

    sendResponse(res, {
        success: true,
        statusCode: httpStatus.OK,
        message: "Payment details retrieved successfully",
        data: result,
    });
});

export const paymentController = {
    createPayment,
    confirmPayment,
    stripeWebhook,
    sslSuccess,
    sslFail,
    sslCancel,
    sslIPN,
    getMyPayments,
    getPaymentById,
};
