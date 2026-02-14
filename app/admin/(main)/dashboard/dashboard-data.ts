import { prisma } from "@/lib/prisma"
import {
    type DashboardKpis,
    type DashboardTrendPoint,
    type TopProductRow,
    type InventoryRow,
    type RestockPendingRow,
    type OrderStatusCount,
    LOW_STOCK_THRESHOLD,
    ORDER_STATUS_LABEL,
} from "./types"
import { getDaysForTrend } from "./dashboard-utils"
import { ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT, ADMIN_DASHBOARD_TOP_PRODUCTS_LIMIT } from "@/app/admin/constants"
import type { OrderStatus } from "@prisma/client"

function getWeekBounds(now: Date) {
    const startOfThisPeriod = new Date(now)
    startOfThisPeriod.setDate(now.getDate() - 7)
    startOfThisPeriod.setHours(0, 0, 0, 0)
    const startOfLastPeriod = new Date(startOfThisPeriod)
    startOfLastPeriod.setDate(startOfLastPeriod.getDate() - 7)
    return { startOfThisPeriod, startOfLastPeriod }
}

/**
 * 核心 KPI：总营收、环比、订单数、环比、完成率、AOV、卡密库存、待补货数量
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
    const now = new Date()
    const { startOfThisPeriod, startOfLastPeriod } = getWeekBounds(now)

    const [
        totalRevenueResult,
        lastPeriodRevenueResult,
        orderCount,
        lastPeriodOrderCount,
        thisPeriodOrderCount,
        orderCountByStatus,
        unsoldCardCount,
        restockPendingCount,
    ] = await Promise.all([
        prisma.order.aggregate({
            where: { status: "COMPLETED" },
            _sum: { amount: true },
            _count: { id: true },
        }),
        prisma.order.aggregate({
            where: {
                status: "COMPLETED",
                paidAt: { gte: startOfLastPeriod, lt: startOfThisPeriod },
            },
            _sum: { amount: true },
        }),
        prisma.order.count(),
        prisma.order.count({
            where: {
                createdAt: { gte: startOfLastPeriod, lt: startOfThisPeriod },
            },
        }),
        prisma.order.count({
            where: { createdAt: { gte: startOfThisPeriod } },
        }),
        prisma.order.groupBy({
            by: ["status"],
            _count: { id: true },
        }),
        prisma.card.count({ where: { status: "UNSOLD" } }),
        prisma.restockSubscription.count({ where: { status: "PENDING" } }),
    ])

    const totalRevenue = Number(totalRevenueResult._sum.amount ?? 0)
    const completedCount = totalRevenueResult._count.id
    const lastPeriodRevenue = Number(lastPeriodRevenueResult._sum.amount ?? 0)
    const revenueTrend =
        lastPeriodRevenue > 0
            ? ((totalRevenue - lastPeriodRevenue) / lastPeriodRevenue) * 100
            : totalRevenue > 0
              ? 100
              : 0
    const orderTrend =
        lastPeriodOrderCount > 0
            ? ((thisPeriodOrderCount - lastPeriodOrderCount) / lastPeriodOrderCount) * 100
            : thisPeriodOrderCount > 0
              ? 100
              : 0

    const statusMap = new Map<OrderStatus, number>()
    for (const row of orderCountByStatus) {
        statusMap.set(row.status, row._count.id)
    }
    const pendingCount = statusMap.get("PENDING") ?? 0
    const closedCount = statusMap.get("CLOSED") ?? 0
    const completionRate = orderCount > 0 ? (completedCount / orderCount) * 100 : 0
    const aov = completedCount > 0 ? totalRevenue / completedCount : 0

    return {
        totalRevenue,
        revenueTrend,
        orderCount,
        orderTrend,
        completedCount,
        pendingCount,
        closedCount,
        completionRate,
        aov,
        unsoldCardCount,
        restockPendingCount,
    }
}

/**
 * 按日聚合的订单数、营收（用于趋势图）
 */
export async function getDashboardTrend(days: number): Promise<DashboardTrendPoint[]> {
    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - days)
    start.setHours(0, 0, 0, 0)

    const dayList = getDaysForTrend(days)
    const chartRaw = await prisma.order.groupBy({
        by: ["createdAt"],
        where: {
            createdAt: { gte: start },
            status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: { id: true },
    })

    return dayList.map((d) => {
        const next = new Date(d)
        next.setDate(next.getDate() + 1)
        const inDay = chartRaw.filter(
            (r) => r.createdAt >= d && r.createdAt < next
        )
        const dayRevenue = inDay.reduce((s, r) => s + Number(r._sum.amount ?? 0), 0)
        const dayOrders = inDay.reduce((s, r) => s + r._count.id, 0)
        return {
            date: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
            订单: dayOrders,
            营收: dayRevenue,
        }
    })
}

/**
 * 订单状态分布（饼图）
 */
export async function getOrderStatusDistribution(): Promise<OrderStatusCount[]> {
    const rows = await prisma.order.groupBy({
        by: ["status"],
        _count: { id: true },
    })
    const statusOrder: OrderStatus[] = ["COMPLETED", "PENDING", "CLOSED"]
    return statusOrder.map((status) => ({
        status,
        label: ORDER_STATUS_LABEL[status],
        count: rows.find((r) => r.status === status)?._count.id ?? 0,
    }))
}

/**
 * 按营收排序的商品 Top N（商品名 + 营收 + 订单数）
 */
export async function getTopProductsByRevenue(
    limit: number = ADMIN_DASHBOARD_TOP_PRODUCTS_LIMIT
): Promise<TopProductRow[]> {
    const [byProduct, products] = await Promise.all([
        prisma.order.groupBy({
            by: ["productId"],
            where: { status: "COMPLETED" },
            _sum: { amount: true },
            _count: { id: true },
        }),
        prisma.product.findMany({
            select: { id: true, name: true },
        }),
    ])
    const nameMap = new Map(products.map((p) => [p.id, p.name]))
    return byProduct
        .map((r) => ({
            productId: r.productId,
            productName: nameMap.get(r.productId) ?? "",
            revenue: Number(r._sum.amount ?? 0),
            orderCount: r._count.id,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
}

/**
 * 各商品 UNSOLD 卡密数量，用于库存预警
 */
export async function getInventoryByProduct(): Promise<InventoryRow[]> {
    const [byProduct, products] = await Promise.all([
        prisma.card.groupBy({
            by: ["productId"],
            where: { status: "UNSOLD" },
            _count: { id: true },
        }),
        prisma.product.findMany({
            select: { id: true, name: true },
        }),
    ])
    const nameMap = new Map(products.map((p) => [p.id, p.name]))
    return byProduct.map((r) => ({
        productId: r.productId,
        productName: nameMap.get(r.productId) ?? "",
        unsoldCount: r._count.id,
        isLowStock: r._count.id < LOW_STOCK_THRESHOLD,
    }))
}

/**
 * 待通知的到货提醒数量（按商品）
 */
export async function getRestockPending(): Promise<RestockPendingRow[]> {
    const [byProduct, products] = await Promise.all([
        prisma.restockSubscription.groupBy({
            by: ["productId"],
            where: { status: "PENDING" },
            _count: { id: true },
        }),
        prisma.product.findMany({
            select: { id: true, name: true },
        }),
    ])
    const nameMap = new Map(products.map((p) => [p.id, p.name]))
    return byProduct.map((r) => ({
        productId: r.productId,
        productName: nameMap.get(r.productId) ?? "",
        pendingCount: r._count.id,
    }))
}

/**
 * 最近订单列表
 */
export async function getRecentOrders(limit: number = ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT) {
    return prisma.order.findMany({
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
            product: { select: { id: true, name: true } },
        },
    })
}

export type DashboardData = {
    kpis: DashboardKpis
    trend7: DashboardTrendPoint[]
    trend30: DashboardTrendPoint[]
    orderStatusDistribution: OrderStatusCount[]
    topProducts: TopProductRow[]
    inventory: InventoryRow[]
    restockPending: RestockPendingRow[]
    recentOrders: Awaited<ReturnType<typeof getRecentOrders>>
}

/**
 * 一次性拉取仪表盘所需全部数据（并行请求）
 */
export async function getDashboardData(): Promise<DashboardData> {
    const [
        kpis,
        trend7,
        trend30,
        orderStatusDistribution,
        topProducts,
        inventory,
        restockPending,
        recentOrders,
    ] = await Promise.all([
        getDashboardKpis(),
        getDashboardTrend(7),
        getDashboardTrend(30),
        getOrderStatusDistribution(),
        getTopProductsByRevenue(),
        getInventoryByProduct(),
        getRestockPending(),
        getRecentOrders(),
    ])
    return {
        kpis,
        trend7,
        trend30,
        orderStatusDistribution,
        topProducts,
        inventory,
        restockPending,
        recentOrders,
    }
}
