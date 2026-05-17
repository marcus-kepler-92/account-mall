"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { BarChart2, TrendingUp, Trophy } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { getInventoryByProduct, getRestockPending, getRecentOrders } from "./dashboard-data"
import { DashboardSalesTab } from "./dashboard-sales-tab"
import { DashboardProfitTab } from "./dashboard-profit-tab"
import { DashboardMilestoneTab } from "./dashboard-milestone-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type InventoryData = Awaited<ReturnType<typeof getInventoryByProduct>>
type RestockData = Awaited<ReturnType<typeof getRestockPending>>
type RecentOrdersData = Awaited<ReturnType<typeof getRecentOrders>>

const TABS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "sales", label: "销量", Icon: BarChart2 },
  { key: "profit", label: "利润", Icon: TrendingUp },
  { key: "milestones", label: "里程碑", Icon: Trophy },
] as const

type TabKey = (typeof TABS)[number]["key"]

function isTabKey(v: string): v is TabKey {
  return TABS.some((t) => t.key === v)
}

export function DashboardTabs({
  inventory,
  restockPending,
  recentOrders,
}: {
  inventory: InventoryData
  restockPending: RestockData
  recentOrders: RecentOrdersData
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const raw = searchParams.get("view") ?? "sales"
  const activeTab: TabKey = isTabKey(raw) ? raw : "sales"

  const setTab = (key: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)} className="gap-4">
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0"
      >
        {TABS.map(({ key, label, Icon }) => (
          <TabsTrigger
            key={key}
            value={key}
            className="rounded-none px-4 py-2 text-sm data-[state=active]:shadow-none"
          >
            <Icon className="size-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="sales" className="mt-0 outline-none">
        <DashboardSalesTab
          inventory={inventory}
          restockPending={restockPending}
          recentOrders={recentOrders}
        />
      </TabsContent>
      <TabsContent value="profit" className="mt-0 outline-none">
        <DashboardProfitTab />
      </TabsContent>
      <TabsContent value="milestones" className="mt-0 outline-none">
        <DashboardMilestoneTab />
      </TabsContent>
    </Tabs>
  )
}
