import { prisma } from "../../lib/prisma";

const MONTHS = 6;

type Point = { label: string; value: number };

const monthStarts = (count: number) => {
    const now = new Date();
    return Array.from({ length: count }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1));
};

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const labelOf = (d: Date) => d.toLocaleString("en-US", { month: "short", year: "2-digit" });

// Buckets rows into the last N calendar months; months with no rows are 0.
const bucketByMonth = <T>(rows: T[], dateOf: (row: T) => Date, valueOf: (row: T) => number, count = MONTHS): Point[] => {
    const starts = monthStarts(count);
    const totals = new Map<string, number>(starts.map((d) => [keyOf(d), 0]));
    for (const row of rows) {
        const key = keyOf(dateOf(row));
        if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + valueOf(row));
    }
    return starts.map((d) => ({ label: labelOf(d), value: Math.round((totals.get(keyOf(d)) ?? 0) * 100) / 100 }));
};

const sinceMonth = (count = MONTHS) => monthStarts(count)[0];

const toStatusPoints = (rows: { status: string; _count: { _all: number } }[]): Point[] =>
    rows.map((r) => ({ label: r.status, value: r._count._all })).sort((a, b) => b.value - a.value);

export type Anomaly = { severity: "info" | "warning" | "critical"; title: string; detail: string };

// Compares the latest month with the average of the earlier months.
const detectAnomalies = (opts: {
    revenueByMonth: Point[];
    ordersByMonth: Point[];
    overdueOrders: number;
    failedPayments: number;
    totalPayments: number;
}): Anomaly[] => {
    const anomalies: Anomaly[] = [];
    const compare = (series: Point[], name: string) => {
        if (series.length < 3) return;
        const current = series[series.length - 1]?.value ?? 0;
        const previous = series.slice(0, -1).filter((p) => p.value > 0);
        if (previous.length === 0) return;
        const avg = previous.reduce((sum, p) => sum + p.value, 0) / previous.length;
        const change = ((current - avg) / avg) * 100;
        if (change <= -40) {
            anomalies.push({
                severity: change <= -70 ? "critical" : "warning",
                title: `${name} dropped ${Math.abs(Math.round(change))}%`,
                detail: `This month's ${name.toLowerCase()} (${current}) is well below the ${previous.length}-month average (${Math.round(avg)}).`,
            });
        } else if (change >= 80) {
            anomalies.push({
                severity: "info",
                title: `${name} up ${Math.round(change)}%`,
                detail: `This month's ${name.toLowerCase()} (${current}) is well above the ${previous.length}-month average (${Math.round(avg)}).`,
            });
        }
    };
    compare(opts.revenueByMonth, "Revenue");
    compare(opts.ordersByMonth, "Orders");

    if (opts.overdueOrders > 0) {
        anomalies.push({
            severity: opts.overdueOrders >= 5 ? "critical" : "warning",
            title: `${opts.overdueOrders} overdue rental${opts.overdueOrders === 1 ? "" : "s"}`,
            detail: "Gear has not been returned by its end date.",
        });
    }
    if (opts.totalPayments >= 5) {
        const rate = (opts.failedPayments / opts.totalPayments) * 100;
        if (rate >= 20) {
            anomalies.push({
                severity: rate >= 40 ? "critical" : "warning",
                title: `${Math.round(rate)}% of payments failed`,
                detail: `${opts.failedPayments} of ${opts.totalPayments} payment attempts failed. Check the payment providers.`,
            });
        }
    }
    return anomalies;
};

const getAdminAnalytics = async () => {
    const since = sinceMonth();

    const [payments, orders, users, ordersByStatus, topItems, overdueOrders, failedPayments, totalPayments, totals] =
        await Promise.all([
            prisma.payment.findMany({
                where: { status: "COMPLETED", createdAt: { gte: since } },
                select: { amount: true, paidAt: true, createdAt: true },
            }),
            prisma.rentalOrder.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
            prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
            prisma.rentalOrder.groupBy({ by: ["status"], _count: { _all: true } }),
            prisma.rentalOrderItem.groupBy({
                by: ["gearId"],
                _sum: { quantity: true },
                orderBy: { _sum: { quantity: "desc" } },
                take: 5,
            }),
            prisma.rentalOrder.count({ where: { status: "OVERDUE" } }),
            prisma.payment.count({ where: { status: "FAILED" } }),
            prisma.payment.count(),
            Promise.all([
                prisma.user.count(),
                prisma.gear.count(),
                prisma.rentalOrder.count(),
                prisma.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }),
            ]),
        ]);

    const gearNames = await prisma.gear.findMany({
        where: { id: { in: topItems.map((t) => t.gearId) } },
        select: { id: true, name: true },
    });
    const nameById = new Map(gearNames.map((g) => [g.id, g.name]));

    const revenueByMonth = bucketByMonth(payments, (p) => p.paidAt ?? p.createdAt, (p) => Number(p.amount));
    const ordersByMonth = bucketByMonth(orders, (o) => o.createdAt, () => 1);
    const usersByMonth = bucketByMonth(users, (u) => u.createdAt, () => 1);

    return {
        totals: {
            users: totals[0],
            gear: totals[1],
            orders: totals[2],
            revenue: Number(totals[3]._sum.amount ?? 0),
        },
        revenueByMonth,
        ordersByMonth,
        usersByMonth,
        ordersByStatus: toStatusPoints(ordersByStatus),
        topGear: topItems.map((t) => ({ label: nameById.get(t.gearId) ?? "Unknown gear", value: t._sum.quantity ?? 0 })),
        anomalies: detectAnomalies({ revenueByMonth, ordersByMonth, overdueOrders, failedPayments, totalPayments }),
    };
};

const getProviderAnalytics = async (providerId: string) => {
    const since = sinceMonth();
    const providerOrders = { items: { some: { gear: { providerId } } } };

    const [gearCount, items, ordersByStatus] = await Promise.all([
        prisma.gear.count({ where: { providerId } }),
        prisma.rentalOrderItem.findMany({
            where: { gear: { providerId }, order: { createdAt: { gte: since } } },
            select: {
                quantity: true,
                subtotal: true,
                gear: { select: { name: true } },
                order: { select: { createdAt: true, paymentStatus: true, status: true } },
            },
        }),
        prisma.rentalOrder.groupBy({ by: ["status"], where: providerOrders, _count: { _all: true } }),
    ]);

    const paid = items.filter((i) => i.order.paymentStatus === "COMPLETED");
    const revenueByMonth = bucketByMonth(paid, (i) => i.order.createdAt, (i) => Number(i.subtotal));
    const rentalsByMonth = bucketByMonth(items, (i) => i.order.createdAt, (i) => i.quantity);

    const perGear = new Map<string, number>();
    for (const i of items) perGear.set(i.gear.name, (perGear.get(i.gear.name) ?? 0) + i.quantity);

    return {
        totals: {
            gear: gearCount,
            revenue: paid.reduce((sum, i) => sum + Number(i.subtotal), 0),
            activeRentals: ordersByStatus
                .filter((s) => ["CONFIRMED", "PICKED_UP", "ONGOING"].includes(s.status))
                .reduce((sum, s) => sum + s._count._all, 0),
            pendingOrders: ordersByStatus.find((s) => s.status === "PENDING")?._count._all ?? 0,
        },
        revenueByMonth,
        rentalsByMonth,
        ordersByStatus: toStatusPoints(ordersByStatus),
        topGear: [...perGear.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5),
    };
};

const getCustomerAnalytics = async (customerId: string) => {
    const since = sinceMonth();

    const [payments, orders, ordersByStatus, totalOrders] = await Promise.all([
        prisma.payment.findMany({
            where: { customerId, status: "COMPLETED", createdAt: { gte: since } },
            select: { amount: true, paidAt: true, createdAt: true },
        }),
        prisma.rentalOrder.findMany({ where: { customerId, createdAt: { gte: since } }, select: { createdAt: true } }),
        prisma.rentalOrder.groupBy({ by: ["status"], where: { customerId }, _count: { _all: true } }),
        prisma.rentalOrder.count({ where: { customerId } }),
    ]);

    return {
        totals: {
            orders: totalOrders,
            spent: payments.reduce((sum, p) => sum + Number(p.amount), 0),
            activeRentals: ordersByStatus
                .filter((s) => ["CONFIRMED", "PICKED_UP", "ONGOING"].includes(s.status))
                .reduce((sum, s) => sum + s._count._all, 0),
            pendingPayments: await prisma.rentalOrder.count({ where: { customerId, paymentStatus: "PENDING", status: { not: "CANCELLED" } } }),
        },
        spendByMonth: bucketByMonth(payments, (p) => p.paidAt ?? p.createdAt, (p) => Number(p.amount)),
        ordersByMonth: bucketByMonth(orders, (o) => o.createdAt, () => 1),
        ordersByStatus: toStatusPoints(ordersByStatus),
    };
};

export const analyticsService = {
    getAdminAnalytics,
    getProviderAnalytics,
    getCustomerAnalytics,
};