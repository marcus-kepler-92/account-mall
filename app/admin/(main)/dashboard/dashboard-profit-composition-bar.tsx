"use client"

import { useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"

type Segment = {
    key: "cost" | "commission" | "milestone" | "profit"
    label: string
    value: number
    color: string
}

export function DashboardProfitCompositionBar({
    revenue,
    cost,
    commission,
    milestoneBonus,
    profit,
    hasMissingCost,
}: {
    revenue: number
    cost: number
    commission: number
    milestoneBonus: number
    profit: number
    hasMissingCost?: boolean
}) {
    const [hovered, setHovered] = useState<Segment["key"] | null>(null)

    if (revenue <= 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                该时段暂无营收数据
            </p>
        )
    }

    // Treat tiny negative profit as 0 in the bar (avoid layout glitch), but keep label honest.
    const segments: Segment[] = [
        { key: "cost", label: "采购成本", value: Math.max(0, cost), color: "bg-amber-400 dark:bg-amber-500" },
        { key: "commission", label: "佣金支出", value: Math.max(0, commission), color: "bg-orange-400 dark:bg-orange-500" },
        { key: "milestone", label: "里程碑奖金", value: Math.max(0, milestoneBonus), color: "bg-yellow-400 dark:bg-yellow-500" },
        { key: "profit", label: "净利润", value: Math.max(0, profit), color: "bg-emerald-500 dark:bg-emerald-500" },
    ]

    const sum = segments.reduce((s, seg) => s + seg.value, 0) || 1
    const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : null

    return (
        <div className="space-y-4">
            {/* Headline narrative: revenue → profit, with margin */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                    <div>
                        <p className="text-xs text-muted-foreground">总营收</p>
                        <p className="text-2xl font-bold tabular-nums">{formatCurrency(revenue)}</p>
                    </div>
                    <div className="pb-1 text-muted-foreground">→</div>
                    <div>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            净利润
                            {hasMissingCost && (
                                <span title="部分商品未设成本，利润偏高" className="cursor-help">
                                    ⚠
                                </span>
                            )}
                        </p>
                        <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                            {formatCurrency(profit)}
                        </p>
                    </div>
                </div>
                {marginPct !== null && (
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground">利润率</p>
                        <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-500">
                            {marginPct}%
                        </p>
                    </div>
                )}
            </div>

            {/* The stacked bar */}
            <div
                className="flex h-7 w-full overflow-hidden rounded-md ring-1 ring-border"
                onMouseLeave={() => setHovered(null)}
            >
                {segments.map((seg) => {
                    const pct = (seg.value / sum) * 100
                    if (pct === 0) return null
                    const dimmed = hovered !== null && hovered !== seg.key
                    return (
                        <div
                            key={seg.key}
                            className={cn(
                                seg.color,
                                "h-full transition-opacity duration-150",
                                dimmed && "opacity-30",
                            )}
                            style={{ width: `${pct}%` }}
                            onMouseEnter={() => setHovered(seg.key)}
                            title={`${seg.label} ${formatCurrency(seg.value)} (${pct.toFixed(1)}%)`}
                        />
                    )
                })}
            </div>

            {/* Breakdown — deduction segments only; profit is already the headline above. */}
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                {segments
                    .filter((seg) => seg.key !== "profit")
                    .map((seg) => {
                        const pct = (seg.value / sum) * 100
                        return (
                            <button
                                key={seg.key}
                                type="button"
                                onMouseEnter={() => setHovered(seg.key)}
                                onMouseLeave={() => setHovered(null)}
                                className={cn(
                                    "flex flex-col items-start gap-0.5 rounded-md border bg-card p-2 text-left transition-colors",
                                    hovered === seg.key && "border-foreground/30",
                                )}
                            >
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className={cn("size-2 rounded-sm", seg.color)} />
                                    {seg.label}
                                </span>
                                <span className="font-semibold tabular-nums">
                                    {formatCurrency(seg.value)}
                                </span>
                                <span className="text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                            </button>
                        )
                    })}
            </div>
        </div>
    )
}
