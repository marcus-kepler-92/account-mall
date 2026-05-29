import { prisma } from "@/lib/prisma"
import { getHKTDayStart } from "@/lib/utils"
import { resolveOrderCost } from "@/lib/profit"
import {
  type DashboardTrendPoint,
  type TopProductRow,
  type InventoryRow,
  type RestockPendingRow,
  LOW_STOCK_THRESHOLD,
} from "./types"
import { getDaysForTrend } from "./dashboard-utils"
import { ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT, ADMIN_DASHBOARD_TOP_PRODUCTS_LIMIT } from "@/app/admin/constants"

/** Dashboard card inventory: manual pool, on-sale catalog only. */
const INVENTORY_PRODUCT_WHERE = {
  productType: "NORMAL" as const,
  status: "ACTIVE" as const,
}

/** Matches KPI "库存需关注" — same rule as `InventoryRow.isLowStock`. */
export function countInventoryAttentionProducts(inventory: InventoryRow[]): number {
  return inventory.filter((r) => r.isLowStock).length
}

/**
 * Daily aggregated order count, revenue, net income (for trend chart)
 */
export async function getDashboardTrend(days: number): Promise<DashboardTrendPoint[]> {
  const now = new Date()
  const todayStart = getHKTDayStart(now)
  const start = new Date(todayStart)
  start.setDate(todayStart.getDate() - (days - 1))

  type PaidAtGroupRow = { paidAt: Date | null; _sum: { amount: unknown }; _count: { id: number } }
  type CommissionGroupRow = { createdAt: Date; _sum: { amount: unknown } }

  const dayList = getDaysForTrend(days)
  const [chartRaw, commissionRaw] = await Promise.all([
    prisma.order.groupBy({
      by: ["paidAt"],
      where: { paidAt: { gte: start }, status: "COMPLETED" },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.commission.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: start }, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    }),
  ])

  return dayList.map((d) => {
    const next = new Date(d)
    next.setDate(next.getDate() + 1)
    const inDay = (chartRaw as PaidAtGroupRow[]).filter(
      (r) => r.paidAt && r.paidAt >= d && r.paidAt < next,
    )
    const dayRevenue = inDay.reduce((s: number, r) => s + Number(r._sum?.amount ?? 0), 0)
    const dayOrders = inDay.reduce((s: number, r) => s + r._count.id, 0)
    const dayCommission = commissionRaw
      .filter((r: CommissionGroupRow) => r.createdAt >= d && r.createdAt < next)
      .reduce((s: number, r: CommissionGroupRow) => s + Number(r._sum.amount ?? 0), 0)
    const dayNetIncome = Math.round((dayRevenue - dayCommission) * 100) / 100
    return {
      date: d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }),
      订单: dayOrders,
      营收: dayRevenue,
      净收入: dayNetIncome,
    }
  })
}

/**
 * Top N products by revenue
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
 * UNSOLD card count per product (including 0), for inventory overview
 */
export async function getInventoryByProduct(): Promise<InventoryRow[]> {
  const [byProduct, products] = await Promise.all([
    prisma.card.groupBy({
      by: ["productId"],
      where: { status: "UNSOLD", product: INVENTORY_PRODUCT_WHERE },
      _count: { id: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true },
      where: INVENTORY_PRODUCT_WHERE,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ])
  const countMap = new Map(byProduct.map((r) => [r.productId, r._count.id]))
  return products.map((p) => {
    const unsoldCount = countMap.get(p.id) ?? 0
    return {
      productId: p.id,
      productName: p.name,
      unsoldCount,
      isLowStock: unsoldCount < LOW_STOCK_THRESHOLD,
    }
  })
}

/**
 * Pending restock subscription count per product
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
 * Recent orders list
 */
export async function getRecentOrders(limit: number = ADMIN_DASHBOARD_RECENT_ORDERS_LIMIT) {
  const rows = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNo: true,
      email: true,
      amount: true,
      status: true,
      createdAt: true,
      productNameSnapshot: true,
      product: { select: { id: true, name: true } },
    },
  })
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }))
}

export type DashboardData = {
  trend7: DashboardTrendPoint[]
  trend30: DashboardTrendPoint[]
  topProducts: TopProductRow[]
  inventory: InventoryRow[]
  restockPending: RestockPendingRow[]
  recentOrders: Awaited<ReturnType<typeof getRecentOrders>>
}

/**
 * Fetch all dashboard data in parallel
 */
export async function getDashboardData(): Promise<DashboardData> {
  const [trend7, trend30, topProducts, inventory, restockPending, recentOrders] =
    await Promise.all([
      getDashboardTrend(7),
      getDashboardTrend(30),
      getTopProductsByRevenue(),
      getInventoryByProduct(),
      getRestockPending(),
      getRecentOrders(),
    ])
  return { trend7, trend30, topProducts, inventory, restockPending, recentOrders }
}

export type GlobalKPI = {
  todayRevenue: number
  todayProfit: number
  todayOrders: number
  lowStockCount: number
  hasMissingCost: boolean
}

export type GlobalKPIMetrics = Omit<GlobalKPI, "lowStockCount">

/**
 * Today revenue / profit / orders / cost warning. Does not query inventory —
 * combine with `countInventoryAttentionProducts(await getInventoryByProduct())` for full `GlobalKPI`.
 *
 * Milestone bonuses are excluded from todayProfit: they reward cumulative invitee
 * spending earned over weeks/months, so attributing the full bonus to the trigger day
 * distorts that day's operational profit. They remain visible in the milestone tab.
 */
export async function getGlobalKPI(): Promise<GlobalKPIMetrics> {
  const now = new Date()
  const todayStart = getHKTDayStart(now)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  const [orders, commissions] = await Promise.all([
    prisma.order.findMany({
      where: { status: "COMPLETED", paidAt: { gte: todayStart, lt: tomorrowStart } },
      select: { amount: true, quantity: true, costSnapshot: true, costTotalSnapshot: true },
    }),
    prisma.commission.aggregate({
      where: {
        status: { not: "CANCELLED" },
        createdAt: { gte: todayStart, lt: tomorrowStart },
      },
      _sum: { amount: true },
    }),
  ])

  const todayRevenue = orders.reduce((s, o) => s + Number(o.amount), 0)
  const costResolutions = orders.map((o) => resolveOrderCost(o))
  const todayCost = costResolutions.reduce((s, r) => s + r.cost, 0)
  const hasMissingCost = costResolutions.some((r) => !r.hasCost)
  const todayCommission = Number(commissions._sum.amount ?? 0)

  return {
    todayRevenue,
    todayProfit: todayRevenue - todayCost - todayCommission,
    todayOrders: orders.length,
    hasMissingCost,
  }
}
