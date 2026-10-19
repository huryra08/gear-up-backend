import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";
import { Prisma } from "../../../generated/prisma/client";

type GearFilters = {
    searchTerm?: string;
    category?: string;
    minPrice?: string;
    maxPrice?: string;
    brand?: string;
    status?: string;
};

const getAllGear = async (filters: GearFilters) => {
    const { searchTerm, category, minPrice, maxPrice, brand, status } = filters;

    const where: Prisma.GearWhereInput = {
        AND: [
            searchTerm
                ? {
                    OR: [
                        { name: { contains: searchTerm, mode: "insensitive" } },
                        { description: { contains: searchTerm, mode: "insensitive" } },
                        { brand: { contains: searchTerm, mode: "insensitive" } },
                    ],
                }
                : {},
            category ? { categoryId: category } : {},
            brand ? { brand: { equals: brand, mode: "insensitive" } } : {},
            status ? { status: status as any } : { status: "AVAILABLE" },
            minPrice ? { pricePerDay: { gte: Number(minPrice) } } : {},
            maxPrice ? { pricePerDay: { lte: Number(maxPrice) } } : {},
        ],
    };

    return prisma.gear.findMany({
        where,
        include: {
            category: true,
            provider: { select: { id: true, name: true, email: true } },
            _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: "desc" },
    });
};

const getGearById = async (id: string) => {
    const gear = await prisma.gear.findUnique({
        where: { id },
        include: {
            category: true,
            provider: { select: { id: true, name: true, email: true, phone: true } },
            reviews: {
                include: { customer: { select: { id: true, name: true } } },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!gear) {
        throw new ApiError(httpStatus.NOT_FOUND, "Gear not found");
    }

    return gear;
};

const createGear = async (providerId: string, payload: Prisma.GearUncheckedCreateInput) => {
    const category = await prisma.category.findUnique({ where: { id: payload.categoryId as string } });

    if (!category) {
        throw new ApiError(httpStatus.NOT_FOUND, `Category with id "${payload.categoryId}" does not exist`);
    }

    return prisma.gear.create({
        data: { ...payload, providerId },
    });
};

const updateGear = async (
    id: string,
    payload: Prisma.GearUncheckedUpdateInput,
    providerId: string,
    isAdmin: boolean
) => {
    const gear = await prisma.gear.findUnique({ where: { id } });

    if (!gear) {
        throw new ApiError(httpStatus.NOT_FOUND, "Gear not found");
    }

    if (gear.providerId !== providerId && !isAdmin) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only update your own gear listings");
    }

    return prisma.gear.update({ where: { id }, data: payload });
};

const deleteGear = async (id: string, providerId: string, isAdmin: boolean) => {
    const gear = await prisma.gear.findUnique({ where: { id } });

    if (!gear) {
        throw new ApiError(httpStatus.NOT_FOUND, "Gear not found");
    }

    if (gear.providerId !== providerId && !isAdmin) {
        throw new ApiError(httpStatus.FORBIDDEN, "You can only remove your own gear listings");
    }

    return prisma.gear.delete({ where: { id } });
};

const getGearsStats = async () => {
    const totalGear = await prisma.gear.count();
    const availableGear = await prisma.gear.count({ where: { status: "AVAILABLE" } });
    const rentedGear = await prisma.gear.count({ where: { status: "RENTED" } });
    const maintenanceGear = await prisma.gear.count({ where: { status: "MAINTENANCE" } });
    const unavailableGear = await prisma.gear.count({ where: { status: "UNAVAILABLE" } });

    return {
        totalGear,
        availableGear,
        rentedGear,
        maintenanceGear,
        unavailableGear,
    };
};

const getMyGear = async (providerId: string) => {
    return prisma.gear.findMany({
        where: { providerId },
        include: { category: true, _count: { select: { orderItems: true, reviews: true } } },
        orderBy: { createdAt: "desc" },
    });
};

export const gearService = {
    getAllGear,
    getGearById,
    createGear,
    updateGear,
    deleteGear,
    getGearsStats,
    getMyGear,
};
