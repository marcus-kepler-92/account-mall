import type { OrderStatus } from "@prisma/client"

/** 订单状态到中文文案 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    PENDING: "待支付",
    COMPLETED: "已完成",
    CLOSED: "已关闭",
}

/** Dashboard 时间范围（趋势图） */
export const DASHBOARD_TREND_DAYS = [7, 30] as const
export type DashboardTrendDays = (typeof DASHBOARD_TREND_DAYS)[number]

/** 库存低阈值，低于此值在仪表盘高亮 */
export const LOW_STOCK_THRESHOLD = 3

/** 趋势图单日数据点 */
export type DashboardTrendPoint = {
    date: string
    订单: number
    营收: number
}

/** 商品表现（营收或订单数） */
export type TopProductRow = {
    productId: string
    productName: string
    revenue: number
    orderCount: number
}

/** 库存预警行 */
export type InventoryRow = {
    productId: string
    productName: string
    unsoldCount: number
    isLowStock: boolean
}

/** 待补货提醒行 */
export type RestockPendingRow = {
    productId: string
    productName: string
    pendingCount: number
}

/** 订单状态分布（饼图） */
export type OrderStatusCount = {
    status: string
    label: string
    count: number
}

/** KPI 汇总 */
export type DashboardKpis = {
    totalRevenue: number
    revenueTrend: number
    orderCount: number
    orderTrend: number
    completedCount: number
    pendingCount: number
    closedCount: number
    completionRate: number
    aov: number
    unsoldCardCount: number
    restockPendingCount: number
}
