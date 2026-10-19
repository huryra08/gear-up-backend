import { prisma } from "../../lib/prisma";
import { activeStatus, Role } from "../../../generated/prisma/enums";

const getAllUsers = async (filters: { role?: Role; searchTerm?: string }) => {
    const users = await prisma.user.findMany({
        where: {
            role: filters.role,
            OR: filters.searchTerm
                ? [
                    { name: { contains: filters.searchTerm, mode: "insensitive" } },
                    { email: { contains: filters.searchTerm, mode: "insensitive" } },
                ]
                : undefined,
        },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            activeStatus: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
    });

    return users;
};

const updateUserStatus = async (userId: string, status: activeStatus) => {
    const user = await prisma.user.update({
        where: { id: userId },
        data: { activeStatus: status },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            activeStatus: true,
        },
    });

    return user;
};

const updateProfile = async (
    userId: string,
    payload: { name?: string; phone?: string; bio?: string; profilePhoto?: string; address?: string }
) => {
    const { name, phone, ...profileData } = payload;

    const result = await prisma.$transaction(async (tx) => {
        if (name || phone) {
            await tx.user.update({
                where: { id: userId },
                data: { name, phone },
            });
        }

        const profile = await tx.profile.upsert({
            where: { UserId: userId },
            update: profileData,
            create: { UserId: userId, ...profileData },
        });

        return profile;
    });

    return result;
};

export const userService = {
    getAllUsers,
    updateUserStatus,
    updateProfile,
};
