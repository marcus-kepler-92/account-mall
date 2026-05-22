"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import { useTheme } from "next-themes"
import { useEChartsTheme, getEChartsTooltip } from "./echarts-theme"
import type { SalesReportSeriesPoint } from "@/app/api/admin/sales-report/route"
import { formatCurrency } from "@/lib/utils"

function shortDate(d: string): string {
    // "2025-03-17" → "3/17"
    const [, m, day] = d.split("-")
    return `${Number(m)}/${Number(day)}`
}

export function DashboardProfitTrendChart({ data }: { data: SalesReportSeriesPoint[] }) {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const colors = useEChartsTheme()

    useEffect(() => {
        queueMicrotask(() => setMounted(true))
    }, [])

    if (data.length === 0) {
        return (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                暂无趋势数据
            </div>
        )
    }

    const tooltipStyle = getEChartsTooltip(colors)
    const axisColor = colors.mutedForeground || colors.foreground || "#666"
    // Match the page palette: amber for cost, green for profit (mirrors text-amber-600 / text-green-600 elsewhere).
    const revenueColor = "#3b82f6" // blue-500
    const costColor = "#f59e0b" // amber-500
    const profitColor = "#10b981" // emerald-500

    const xLabels = data.map((d) => shortDate(d.date))

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        legend: {
            data: ["营收", "成本", "利润"],
            textStyle: { color: colors.foreground },
            top: 0,
            right: 0,
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
        },
        grid: { left: "3%", right: "3%", top: 36, bottom: 8, containLabel: true },
        tooltip: {
            ...tooltipStyle,
            trigger: "axis",
            axisPointer: {
                type: "line",
                lineStyle: { color: colors.border, width: 1 },
                label: { show: false },
            },
            formatter: (params: unknown) => {
                if (!Array.isArray(params) || params.length === 0) return ""
                const idx = (params[0] as { dataIndex: number }).dataIndex
                const point = data[idx]
                if (!point) return ""
                return [
                    `<div style="font-weight:600;margin-bottom:4px">${point.date}</div>`,
                    `<div>营收：<span style="color:${revenueColor}">${formatCurrency(point.revenue)}</span></div>`,
                    `<div>成本：<span style="color:${costColor}">${formatCurrency(point.cost)}</span></div>`,
                    `<div>利润：<span style="color:${profitColor}">${formatCurrency(point.profit)}</span></div>`,
                    `<div style="margin-top:4px;color:${axisColor}">销量 ${point.quantity}　订单 ${point.orderCount}</div>`,
                ].join("")
            },
        },
        xAxis: {
            type: "category",
            data: xLabels,
            boundaryGap: false,
            axisLine: { lineStyle: { color: colors.border } },
            axisTick: { show: false },
            axisLabel: { color: axisColor },
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
            // Cost on the bottom — usually the smallest values; thin so it doesn't dominate.
            {
                name: "成本",
                type: "line",
                smooth: true,
                showSymbol: false,
                symbol: "rect",
                symbolSize: 8,
                data: data.map((d) => d.cost),
                lineStyle: { color: costColor, width: 1.5 },
                itemStyle: { color: costColor },
                emphasis: { focus: "none", scale: 1.2 },
                z: 2,
            },
            // Revenue in the middle layer — the gross outline of business size.
            {
                name: "营收",
                type: "line",
                smooth: true,
                showSymbol: false,
                symbol: "circle",
                symbolSize: 8,
                data: data.map((d) => d.revenue),
                lineStyle: { color: revenueColor, width: 2 },
                itemStyle: { color: revenueColor },
                emphasis: { focus: "none", scale: 1.2 },
                z: 3,
            },
            // Profit on top — the headline metric, slightly thicker and always visible above overlaps.
            {
                name: "利润",
                type: "line",
                smooth: true,
                showSymbol: false,
                symbol: "triangle",
                symbolSize: 9,
                data: data.map((d) => d.profit),
                lineStyle: { color: profitColor, width: 2.5 },
                itemStyle: { color: profitColor },
                emphasis: { focus: "none", scale: 1.2 },
                z: 4,
            },
        ],
    }

    if (!mounted) {
        return <div className="h-[280px] w-full min-w-0" />
    }

    return (
        <div className="h-[280px] w-full min-w-0">
            <ReactECharts
                key={resolvedTheme ?? "light"}
                option={option}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
            />
        </div>
    )
}
