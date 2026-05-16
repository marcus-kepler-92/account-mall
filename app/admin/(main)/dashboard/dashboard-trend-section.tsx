"use client"

import { useState } from "react"
import { DashboardChart } from "./dashboard-chart"
import type { DashboardTrendPoint } from "./types"
import { Button } from "@/components/ui/button"

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
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">时间范围</span>
        <Button
          type="button"
          variant={days === 7 ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDays(7)}
        >
          近 7 日
        </Button>
        <Button
          type="button"
          variant={days === 30 ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setDays(30)}
        >
          近 30 日
        </Button>
      </div>
      <DashboardChart data={data} />
    </div>
  )
}
