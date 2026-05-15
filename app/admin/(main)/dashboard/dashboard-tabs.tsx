"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type { getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"
import { DashboardSalesTab } from "./dashboard-sales-tab"
import { DashboardProfitTab } from "./dashboard-profit-tab"
import { DashboardMilestoneTab } from "./dashboard-milestone-tab"

type InventoryData = Awaited<ReturnType<typeof getInventoryByProduct>>
type RestockData = Awaited<ReturnType<typeof getRestockPending>>
type RecentOrdersData = Awaited<ReturnType<typeof getRecentOrders>>

const TABS = [
  { key: "sales", label: "📊 销量" },
  { key: "profit", label: "💰 利润" },
  { key: "milestones", label: "🏅 里程碑" },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function DashboardTabs({
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
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTab = (searchParams.get("view") ?? "sales") as TabKey

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-0 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === "sales" && (
        <DashboardSalesTab
          lowStockCount={lowStockCount}
          inventory={inventory}
          restockPending={restockPending}
          recentOrders={recentOrders}
        />
      )}
      {activeTab === "profit" && <DashboardProfitTab />}
      {activeTab === "milestones" && <DashboardMilestoneTab />}
    </div>
  )
}
