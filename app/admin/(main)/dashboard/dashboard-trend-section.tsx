"use client"

import { useState } from "react"
import { DashboardChart } from "./dashboard-chart"
import type { DashboardTrendPoint } from "./types"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

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
                <Select
                    value={String(days)}
                    onValueChange={(v) => setDays(Number(v) as 7 | 30)}
                >
                    <SelectTrigger className="w-[7rem]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">近 7 日</SelectItem>
                        <SelectItem value="30">近 30 日</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DashboardChart data={data} />
        </div>
    )
}
