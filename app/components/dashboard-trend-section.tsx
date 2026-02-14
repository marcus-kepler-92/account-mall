"use client"

import { useState } from "react"
import { DashboardChart } from "@/app/components/dashboard-chart"
import type { DashboardTrendPoint } from "@/app/admin/(main)/dashboard/types"

export function DashboardTrendSection({
    trend7,
    trend30,
}: {
    trend7: DashboardTrendPoint[]
    trend30: DashboardTrendPoint[]
}) {
    const [days, setDays] = useState<7 | 30>(7)
    const data = days === 7 ? trend7 : trend30
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">时间范围</span>
                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) as 7 | 30)}
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                >
                    <option value={7}>近 7 日</option>
                    <option value={30}>近 30 日</option>
                </select>
            </div>
            <DashboardChart data={data} />
        </div>
    )
}
