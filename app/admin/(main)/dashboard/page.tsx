import { Suspense } from "react"
import { config } from "@/lib/config"
import { PageHeader } from "@/app/admin/components"
import {
  getGlobalKPI,
  getInventoryByProduct,
  getRestockPending,
  getRecentOrders,
  countInventoryAttentionProducts,
  type GlobalKPI,
} from "./dashboard-data"
import { DashboardGlobalKPI } from "./dashboard-global-kpi"
import { DashboardTabs } from "./dashboard-tabs"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const [metrics, inventory, restockPending, recentOrders] = await Promise.all([
    getGlobalKPI(),
    getInventoryByProduct(),
    getRestockPending(),
    getRecentOrders(),
  ])

  const kpi: GlobalKPI = {
    ...metrics,
    lowStockCount: countInventoryAttentionProducts(inventory),
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="概览"
        description={`欢迎使用 ${config.siteName} ${config.adminPanelLabel}`}
      />
      <DashboardGlobalKPI kpi={kpi} />
      <Suspense>
        <DashboardTabs
          inventory={inventory}
          restockPending={restockPending}
          recentOrders={recentOrders}
        />
      </Suspense>
    </div>
  )
}
