import httpStatus from "http-status";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../utils/apiError";

const createCategory = async (payload: { name: string; description?: string; icon?: string }) => {
    const existing = await prisma.category.findUnique({ where: { name: payload.name } });

    if (existing) {
        throw new ApiError(httpStatus.CONFLICT, "A category with this name already exists");
    }

    return prisma.category.create({ data: payload });
};

const getAllCategories = async () => {
    return prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { gears: true } } },
    });
};

const updateCategory = async (id: string, payload: { name?: string; description?: string; icon?: string }) => {
    return prisma.category.update({ where: { id }, data: payload });
};

const deleteCategory = async (id: string) => {
    return prisma.category.delete({ where: { id } });
};

export const categoryService = {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory,
};
