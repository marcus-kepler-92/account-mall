"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import { useTheme } from "next-themes"
import { useEChartsTheme, getEChartsTooltip } from "./echarts-theme"
import { formatCurrency } from "@/lib/utils"

export type ProfitWaterfallMode = "operating" | "net"

type StepKind = "total" | "deduction"

type Step = {
    name: string
    value: number
    color: string
    kind: StepKind
}

export function DashboardProfitWaterfall({
    mode,
    revenue,
    cost,
    commission,
    milestoneBonus,
    profit,
    hasMissingCost,
}: {
    /**
     * "operating": short window (today / yesterday / this-week). Bottom-line is
     * operating profit; milestone bonus shown as side note only.
     *
     * "net": long window (this-month / custom). Bottom-line is net profit;
     * milestone bonus appears as one of the deduction steps.
     */
    mode: ProfitWaterfallMode
    revenue: number
    cost: number
    commission: number
    milestoneBonus: number
    /** Operating profit: revenue - cost - commission. */
    profit: number
    hasMissingCost?: boolean
}) {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const colors = useEChartsTheme()

    useEffect(() => {
        queueMicrotask(() => setMounted(true))
    }, [])

    if (revenue <= 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                该时段暂无营收数据
            </p>
        )
    }

    const isNet = mode === "net"
    const hasMilestone = milestoneBonus > 0
    const operatingProfit = profit
    const netProfit = operatingProfit - milestoneBonus
    const finalValue = isNet ? netProfit : operatingProfit
    const finalLabel = isNet ? "净利润" : "运营利润"

    // Palette consistent with the trend chart and the rest of the dashboard.
    const revenueColor = "#3b82f6" // blue-500
    const costColor = "#f59e0b" // amber-500
    const commissionColor = "#fb923c" // orange-400
    const milestoneColor = "#eab308" // yellow-500
    const profitColor = finalValue >= 0 ? "#10b981" /* emerald-500 */ : "#ef4444" /* red-500 */
    const axisColor = colors.mutedForeground || colors.foreground || "#666"
    const tooltipStyle = getEChartsTooltip(colors)

    const steps: Step[] = isNet
        ? [
              { name: "总营收", value: revenue, color: revenueColor, kind: "total" },
              { name: "采购成本", value: cost, color: costColor, kind: "deduction" },
              { name: "佣金支出", value: commission, color: commissionColor, kind: "deduction" },
              { name: "里程碑奖金", value: milestoneBonus, color: milestoneColor, kind: "deduction" },
              { name: finalLabel, value: finalValue, color: profitColor, kind: "total" },
          ]
        : [
              { name: "总营收", value: revenue, color: revenueColor, kind: "total" },
              { name: "采购成本", value: cost, color: costColor, kind: "deduction" },
              { name: "佣金支出", value: commission, color: commissionColor, kind: "deduction" },
              { name: finalLabel, value: finalValue, color: profitColor, kind: "total" },
          ]

    // Build classic waterfall: transparent base series lifts each deduction bar to
    // where the previous step left off; the colored series is the actual delta.
    const placeholderData: number[] = []
    const visibleData: { value: number; itemStyle: { color: string } }[] = []
    const runningTotals: number[] = [] // post-step value, used in tooltip

    let running = 0
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const isLast = i === steps.length - 1
        if (i === 0) {
            // 总营收: full bar from 0
            placeholderData.push(0)
            visibleData.push({ value: step.value, itemStyle: { color: step.color } })
            running = step.value
        } else if (step.kind === "deduction") {
            const next = running - step.value
            // Bar sits between next (lower edge) and running (upper edge) → height = step.value
            placeholderData.push(Math.max(0, next))
            visibleData.push({ value: step.value, itemStyle: { color: step.color } })
            running = next
        } else if (isLast) {
            // Final total bar: anchored at 0, full height = finalValue (handles negative)
            placeholderData.push(0)
            visibleData.push({ value: step.value, itemStyle: { color: step.color } })
        }
        runningTotals.push(running)
    }

    // Dashed connector lines linking each step's exit level to the next step's entry
    // level — turns 5 disconnected bars into a continuous waterfall narrative.
    const connectorLines: [{ coord: [number, number] }, { coord: [number, number] }][] =
        steps.slice(0, -1).map((_, i) => {
            const y = runningTotals[i]
            return [{ coord: [i, y] }, { coord: [i + 1, y] }]
        })

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        grid: { left: "3%", right: "3%", top: 36, bottom: 12, containLabel: true },
        tooltip: {
            ...tooltipStyle,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: unknown) => {
                if (!Array.isArray(params) || params.length === 0) return ""
                const idx = (params[0] as { dataIndex: number }).dataIndex
                const step = steps[idx]
                if (!step) return ""
                const pct = revenue > 0 ? (step.value / revenue) * 100 : 0
                const sign = step.kind === "deduction" ? "−" : ""
                const lines = [
                    `<div style="font-weight:600;margin-bottom:4px">${step.name}</div>`,
                    `<div>${step.kind === "deduction" ? "扣减" : "金额"}：<span style="color:${step.color};font-weight:600">${sign}${formatCurrency(step.value)}</span></div>`,
                    `<div style="color:${axisColor}">占营收：${pct.toFixed(1)}%</div>`,
                ]
                if (step.kind === "deduction") {
                    lines.push(
                        `<div style="margin-top:4px;color:${axisColor}">扣减后余额：${formatCurrency(runningTotals[idx])}</div>`,
                    )
                }
                return lines.join("")
            },
        },
        xAxis: {
            type: "category",
            data: steps.map((s) => s.name),
            axisLine: { lineStyle: { color: colors.border } },
            axisTick: { show: false },
            axisLabel: { color: axisColor, fontSize: 12, fontWeight: 500 },
        },
        yAxis: {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: colors.border, type: "dashed" } },
            axisLabel: {
                color: axisColor,
                formatter: (v: number) => {
                    if (Math.abs(v) >= 10000) return `¥${(v / 10000).toFixed(1)}w`
                    if (Math.abs(v) >= 1000) return `¥${(v / 1000).toFixed(1)}k`
                    return `¥${v}`
                },
            },
        },
        series: [
            {
                // Transparent lifter — places each deduction bar at the right vertical
                // offset so it visually "drops" from the previous running total.
                name: "placeholder",
                type: "bar",
                stack: "waterfall",
                silent: true,
                itemStyle: { color: "transparent" },
                emphasis: { itemStyle: { color: "transparent" } },
                data: placeholderData,
            },
            {
                name: "value",
                type: "bar",
                stack: "waterfall",
                barWidth: "48%",
                // Ensure tiny deductions (e.g., a ¥46 milestone on a ¥15k axis) remain
                // visible — otherwise they collapse to sub-pixel and the chart "lies".
                barMinHeight: 6,
                itemStyle: { borderRadius: [3, 3, 0, 0] },
                label: {
                    show: true,
                    position: "top",
                    color: colors.foreground,
                    fontSize: 12,
                    fontWeight: 600,
                    formatter: (p: { dataIndex: number }) => {
                        const step = steps[p.dataIndex]
                        const sign = step.kind === "deduction" ? "−" : ""
                        return `${sign}${formatCurrency(step.value)}`
                    },
                },
                markLine: {
                    symbol: ["none", "none"],
                    silent: true,
                    animation: false,
                    lineStyle: {
                        color: axisColor,
                        type: "dashed",
                        width: 1,
                        opacity: 0.55,
                    },
                    label: { show: false },
                    data: connectorLines,
                },
                data: visibleData,
            },
        ],
    }

    return (
        <div className="space-y-4">
            <div className="h-[320px] w-full min-w-0">
                {mounted ? (
                    <ReactECharts
                        key={resolvedTheme ?? "light"}
                        option={option}
                        style={{ height: "100%", width: "100%" }}
                        opts={{ renderer: "canvas" }}
                        notMerge
                    />
                ) : null}
            </div>

            {hasMissingCost && (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                    ⚠ 部分订单缺成本数据，采购成本可能偏低、利润可能偏高
                </p>
            )}

            {/* Operating-mode side note: milestone bonus exists for the period but
                isn't part of the operating-profit computation. */}
            {!isNet && hasMilestone && (
                <div className="flex flex-col gap-1 rounded-md border border-dashed bg-muted/30 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-sm bg-yellow-400 dark:bg-yellow-500" />
                        <span>
                            本期触发{" "}
                            <span className="font-semibold text-foreground">
                                里程碑奖金 −{formatCurrency(milestoneBonus)}
                            </span>
                        </span>
                        <span
                            className="cursor-help text-muted-foreground/70"
                            title="奖励下线累计消费（可能跨数周到数月），已实际支付。短期窗口不归集此项；切到本月或自定义窗口可见含此项的完整净利润。"
                        >
                            ⓘ
                        </span>
                    </div>
                    <span className="text-muted-foreground">跨期累积事件 · 不计入运营利润</span>
                </div>
            )}
        </div>
    )
}
