import { prisma } from "../../lib/prisma";

const getAllGear = async () => {
    return prisma.gear.findMany({
        include: {
            category: true,
            provider: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });
};

const getAllRentals = async () => {
    return prisma.rentalOrder.findMany({
        include: {
            customer: { select: { id: true, name: true, email: true } },
            items: { include: { gear: { select: { id: true, name: true } } } },
            payments: true,
        },
        orderBy: { createdAt: "desc" },
    });
};

const getDashboardStats = async () => {
    const [totalUsers, totalCustomers, totalProviders, totalGear, totalOrders, totalRevenue] =
        await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { role: "CUSTOMER" } }),
            prisma.user.count({ where: { role: "PROVIDER" } }),
            prisma.gear.count(),
            prisma.rentalOrder.count(),
            prisma.payment.aggregate({
                where: { status: "COMPLETED" },
                _sum: { amount: true },
            }),
        ]);

    return {
        totalUsers,
        totalCustomers,
        totalProviders,
        totalGear,
        totalOrders,
        totalRevenue: totalRevenue._sum.amount ?? 0,
    };
};

export const adminService = {
    getAllGear,
    getAllRentals,
    getDashboardStats,
};
