"use client"
import type { getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"

type InventoryData = Awaited<ReturnType<typeof getInventoryByProduct>>
type RestockData = Awaited<ReturnType<typeof getRestockPending>>
type RecentOrdersData = Awaited<ReturnType<typeof getRecentOrders>>

export function DashboardSalesTab({
  lowStockCount,
  inventory,
  restockPending,
  recentOrders,
}: {
  lowStockCount: number
  inventory: InventoryData
  restockPending: RestockData
  recentOrders: RecentOrdersData
}) {
  return <div className="py-8 text-center text-sm text-muted-foreground">销量看板（建设中）</div>
}
