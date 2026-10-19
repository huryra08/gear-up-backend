import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { initSSLCommerzSession, validateSSLCommerzPayment } from "../../lib/sslcommerz";
import { generateTransactionId } from "../../utils/generateOrderNumber";
import { PaymentProvider } from "../../../generated/prisma/enums";
import { ApiError } from "../../utils/apiError";
import { stripe } from "../../lib/stripe";



const createPayment = async (
    customerId: string,
    payload: { rentalOrderId: string; provider: PaymentProvider }) => {
    const order = await prisma.rentalOrder.findUnique({
        where: { id: payload.rentalOrderId },
        include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
        },
    });

    if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, "Rental order not found");
    }

    if (order.customerId !== customerId) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only pay for your own rental orders");
    }

    const existingPaid = await prisma.payment.findFirst({
        where: { rentalOrderId: order.id, status: "COMPLETED" },
    });

    if (existingPaid) {
        throw new ApiError(httpStatus.CONFLICT, "This rental order has already been paid");
    }

    const transactionId = generateTransactionId();


    if (payload.provider === "SSLCOMMERZ") {
        const session = await initSSLCommerzSession({
            transactionId,
            amount: Number(order.totalAmount),
            customerName: order.customer.name,
            customerEmail: order.customer.email,
            customerPhone: order.customer.phone ?? "01700000000",
        });

        const payment = await prisma.payment.create({
            data: {
                transactionId,
                sslSessionKey: session.sessionKey,
                amount: order.totalAmount,
                provider: "SSLCOMMERZ",
                status: "PENDING",
                rentalOrderId: order.id,
                customerId,
            },
        });

        return {
            payment,
            checkoutUrl: session.checkoutUrl, 
        };
    }

  
    const amountInCents = Math.round(Number(order.totalAmount) * 100);

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        metadata: {
            rentalOrderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            transactionId,
        },
        description: `GearUp Rental — Order ${order.orderNumber}`,
        receipt_email: order.customer.email,
    });

    
    const payment = await prisma.payment.create({
        data: {
            transactionId,
            stripePaymentIntentId: paymentIntent.id,
            amount: order.totalAmount,
            provider: "STRIPE",
            status: "PENDING",
            rentalOrderId: order.id,
            customerId,
        },
    });

    return {
        payment,
        clientSecret: paymentIntent.client_secret,  
        paymentIntentId: paymentIntent.id,
    };
};



const confirmPayment = async (payload: { transactionId: string; status: "COMPLETED" | "FAILED" }) => {
    const payment = await prisma.payment.findUnique({
        where: { transactionId: payload.transactionId },
    });

    if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    const updated = await prisma.$transaction(async (tx: any) => {
        const result = await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: payload.status,
                paidAt: payload.status === "COMPLETED" ? new Date() : undefined,
            },
        });

        await tx.rentalOrder.update({
            where: { id: payment.rentalOrderId },
            data: {
                paymentStatus: payload.status,
                status: payload.status === "COMPLETED" ? "CONFIRMED" : undefined,
            },
        });

        return result;
    });

    return updated;
};



const handleStripeWebhook = async (rawBody: Buffer, signature: string, webhookSecret: string) => {
    let event: any;

    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {

        case "payment_intent.succeeded": {
            const intent = event.data.object;
            const { transactionId, rentalOrderId } = intent.metadata;

            await prisma.$transaction(async (tx: any) => {
                await tx.payment.updateMany({
                    where: { transactionId },
                    data: { status: "COMPLETED", paidAt: new Date() },
                });

                await tx.rentalOrder.update({
                    where: { id: rentalOrderId },
                    data: { paymentStatus: "COMPLETED", status: "CONFIRMED" },
                });
            });

            console.log(` Payment succeeded for order ${rentalOrderId}`);
            break;
        }

        // Payment failed — mark as FAILED
        case "payment_intent.payment_failed": {
            const intent = event.data.object;
            const { transactionId, rentalOrderId } = intent.metadata;

            await prisma.$transaction(async (tx: any) => {
                await tx.payment.updateMany({
                    where: { transactionId },
                    data: { status: "FAILED" },
                });

                await tx.rentalOrder.update({
                    where: { id: rentalOrderId },
                    data: { paymentStatus: "FAILED" },
                });
            });

            console.log(` Payment failed for order ${rentalOrderId}`);
            break;
        }

        case "charge.refunded": {
            const charge = event.data.object;
            const paymentIntentId = charge.payment_intent;

            await prisma.payment.updateMany({
               
                where: ({ stripePaymentIntentId: paymentIntentId } as any),
                data: { status: "REFUNDED" },
            });

            console.log(`Payment refunded for intent ${paymentIntentId}`);
            break;
        }

        default:
            console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
};



const confirmSSLCommerzPayment = async (payload: { tran_id: string; val_id: string }) => {
    if (!payload.val_id) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Missing val_id");
    }

    const payment = await prisma.payment.findUnique({
        where: { transactionId: payload.tran_id },
    });

    if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }


    if (payment.status === "COMPLETED") {
        return payment;
    }

    const validation = await validateSSLCommerzPayment(payload.val_id);

    if (validation.status !== "VALID" && validation.status !== "VALIDATED") {
        throw new ApiError(httpStatus.BAD_REQUEST, "SSLCommerz payment could not be validated");
    }

    if (validation.tran_id !== payment.transactionId) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Transaction ID mismatch during validation");
    }

    const updated = await prisma.$transaction(async (tx: any) => {
        const result = await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: "COMPLETED",
                paidAt: new Date(),
                sslValId: payload.val_id,
                method: validation.card_type ?? undefined,
            },
        });

        await tx.rentalOrder.update({
            where: { id: payment.rentalOrderId },
            data: { paymentStatus: "COMPLETED", status: "CONFIRMED" },
        });

        return result;
    });

    return updated;
};


const markSSLCommerzPaymentFailed = async (transactionId: string) => {
    const payment = await prisma.payment.findUnique({
        where: { transactionId },
    });

    if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (payment.status === "COMPLETED") {
        return payment;
    }

    const updated = await prisma.$transaction(async (tx: any) => {
        const result = await tx.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED" },
        });

        await tx.rentalOrder.update({
            where: { id: payment.rentalOrderId },
            data: { paymentStatus: "FAILED" },
        });

        return result;
    });

    return updated;
};



const getMyPayments = async (customerId: string) => {
    return prisma.payment.findMany({
        where: { customerId },
        include: {
            rentalOrder: {
                select: { id: true, orderNumber: true, totalAmount: true, status: true },
            },
        },
        orderBy: { createdAt: "desc" },
    });
};

const getPaymentById = async (id: string, customerId: string, role: string) => {
    const payment = await prisma.payment.findUnique({
        where: { id },
        include: { rentalOrder: true },
    });

    if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, "Payment not found");
    }

    if (role !== "ADMIN" && payment.customerId !== customerId) {
        throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this payment");
    }

    return payment;
};

export const paymentService = {
    createPayment,
    confirmPayment,
    handleStripeWebhook,
    confirmSSLCommerzPayment,
    markSSLCommerzPaymentFailed,
    getMyPayments,
    getPaymentById,
};
