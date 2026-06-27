"use client"

import { useRouter } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TABS = [
    { value: "overview", label: "总览" },
    { value: "orders", label: "订单" },
    { value: "commissions", label: "佣金" },
    { value: "withdrawals", label: "提现" },
    { value: "team", label: "团队" },
] as const

export function DistributorDetailTabs({
    id,
    activeTab,
}: {
    id: string
    activeTab: string
}) {
    const router = useRouter()

    return (
        <Tabs
            value={activeTab}
            onValueChange={(tab) => {
                // Switching tab resets every per-tab param (page/pageSize/status/
                // sort/sortDir) by navigating to a clean ?tab= URL — otherwise a
                // stale page=N from another tab would yield an empty table.
                router.push(`/admin/distributors/${id}?tab=${tab}`)
            }}
        >
            <TabsList>
                {TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value}>
                        {t.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    )
}
