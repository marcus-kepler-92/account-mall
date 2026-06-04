import { Suspense } from "react"
import { config } from "@/lib/config"
import { PageHeader } from "@/app/admin/components"
import {
  getGlobalKPI,
  getInventoryByProduct,
  getRestockPending,
  getRecentOrders,
} from "./dashboard-data"
import { DashboardGlobalKPI } from "./dashboard-global-kpi"
import { DashboardTabs } from "./dashboard-tabs"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const [kpi, inventory, restockPending, recentOrders] = await Promise.all([
    getGlobalKPI(),
    getInventoryByProduct(),
    getRestockPending(),
    getRecentOrders(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="仪表盘"
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
