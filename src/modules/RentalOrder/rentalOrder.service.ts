import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { generateOrderNumber } from "../../utils/generateOrderNumber";
import { Role } from "../../../generated/prisma/enums";

type CreateRentalItem = {
    gearId: string;
    quantity: number;
};

type CreateRentalPayload = {
    startDate: string;
    endDate: string;
    items: CreateRentalItem[];
};

const msPerDay = 1000 * 60 * 60 * 24;

const createRentalOrder = async (customerId: string, payload: CreateRentalPayload) => {
    const { startDate, endDate, items } = payload;

    if (!items || items.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, "At least one gear item is required");
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid rental date range");
    }

    const rentalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerDay));

    return prisma.$transaction(async (tx) => {
        let totalAmount = 0;
        const orderItemsData = [];

        for (const item of items) {
            const gear = await tx.gear.findUnique({ where: { id: item.gearId } });

            if (!gear) {
                throw new ApiError(httpStatus.NOT_FOUND, `Gear ${item.gearId} not found`);
            }

            if (gear.status !== "AVAILABLE") {
                throw new ApiError(httpStatus.BAD_REQUEST, `"${gear.name}" is not currently available`);
            }

            if (gear.quantity < item.quantity) {
                throw new ApiError(httpStatus.BAD_REQUEST, `Not enough stock for "${gear.name}"`);
            }

            const subtotal = Number(gear.pricePerDay) * item.quantity * rentalDays;
            totalAmount += subtotal;

            orderItemsData.push({
                gearId: gear.id,
                quantity: item.quantity,
                pricePerDay: gear.pricePerDay,
                subtotal,
            });

            await tx.gear.update({
                where: { id: gear.id },
                data: { quantity: { decrement: item.quantity } },
            });
        }

        const order = await tx.rentalOrder.create({
            data: {
                orderNumber: generateOrderNumber(),
                customerId,
                startDate: start,
                endDate: end,
                totalAmount,
                items: { create: orderItemsData },
            },
            include: {
                items: { include: { gear: true } },
            },
        });

        return order;
    });
};

const getMyOrders = async (customerId: string) => {
    return prisma.rentalOrder.findMany({
        where: { customerId },
        include: {
            items: { include: { gear: { select: { id: true, name: true, images: true } } } },
            payments: true,
        },
        orderBy: { createdAt: "desc" },
    });
};

const getProviderOrders = async (providerId: string) => {
    return prisma.rentalOrder.findMany({
        where: { items: { some: { gear: { providerId } } } },
        include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            items: {
                where: { gear: { providerId } },
                include: { gear: { select: { id: true, name: true, images: true } } },
            },
        },
        orderBy: { createdAt: "desc" },
    });
};

const getAllOrders = async () => {
    return prisma.rentalOrder.findMany({
        include: {
            customer: { select: { id: true, name: true, email: true } },
            items: { include: { gear: { select: { id: true, name: true } } } },
            payments: true,
        },
        orderBy: { createdAt: "desc" },
    });
};

const getOrderById = async (id: string, requester: { id: string; role: Role }) => {
    const order = await prisma.rentalOrder.findUnique({
        where: { id },
        include: {
            customer: { select: { id: true, name: true, email: true, phone: true } },
            items: { include: { gear: true } },
            payments: true,
        },
    });

    if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, "Rental order not found");
    }

    const isOwner = order.customerId === requester.id;
    const isProviderOfAnItem = order.items.some((item) => item.gear.providerId === requester.id);

    if (requester.role !== "ADMIN" && !isOwner && !isProviderOfAnItem) {
        throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this rental order");
    }

    return order;
};

const updateOrderStatus = async (
    id: string,
    providerId: string,
    role: Role,
    status: "CONFIRMED" | "PICKED_UP" | "ONGOING" | "RETURNED" | "CANCELLED"
) => {
    const order = await prisma.rentalOrder.findUnique({
        where: { id },
        include: { items: { include: { gear: true } } },
    });

    if (!order) {
        throw new ApiError(httpStatus.NOT_FOUND, "Rental order not found");
    }

    if (role !== "ADMIN") {
        const ownsAnItem = order.items.some((item) => item.gear.providerId === providerId);
        if (!ownsAnItem) {
            throw new ApiError(httpStatus.FORBIDDEN, "You can only update orders containing your own gear");
        }
    }

    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.rentalOrder.update({
            where: { id },
            data: {
                status,
                returnedAt: status === "RETURNED" ? new Date() : undefined,
            },
            include: { items: true },
        });

        
        if (status === "RETURNED" || status === "CANCELLED") {
            for (const item of order.items) {
                await tx.gear.update({
                    where: { id: item.gearId },
                    data: { quantity: { increment: item.quantity } },
                });
            }
        }

        return result;
    });

    return updated;
};

export const rentalOrderService = {
    createRentalOrder,
    getMyOrders,
    getProviderOrders,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
};
