import type { OrderStatus } from "@prisma/client"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "待支付",
  COMPLETED: "已完成",
  CLOSED: "已关闭",
}

export const DASHBOARD_TREND_DAYS = [7, 30] as const
export type DashboardTrendDays = (typeof DASHBOARD_TREND_DAYS)[number]

export const LOW_STOCK_THRESHOLD = 3

export type DashboardTrendPoint = {
  date: string
  订单: number
  营收: number
  净收入: number
}

export type TopProductRow = {
  productId: string
  productName: string
  revenue: number
  orderCount: number
}

export type InventoryRow = {
  productId: string
  productName: string
  unsoldCount: number
  isLowStock: boolean
}

export type RestockPendingRow = {
  productId: string
  productName: string
  pendingCount: number
}
