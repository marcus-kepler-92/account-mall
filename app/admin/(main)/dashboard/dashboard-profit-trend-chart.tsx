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

export function DashboardProfitTrendChart({
    data,
}: {
    data: SalesReportSeriesPoint[]
}) {
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

    if (data.length === 1) {
        // Single-day window: a "trend" needs at least two points; rendering one dot is noise.
        return (
            <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                选择更长时间窗口（本周 / 本月 / 自定义）查看趋势
            </div>
        )
    }

    const tooltipStyle = getEChartsTooltip(colors)
    const axisColor = colors.mutedForeground || colors.foreground || "#666"
    const revenueColor = "#3b82f6" // blue-500
    const profitColor = "#10b981" // emerald-500

    const xLabels = data.map((d) => shortDate(d.date))

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        legend: {
            data: ["营收", "运营利润"],
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
                const marginPct = point.revenue > 0 ? (point.profit / point.revenue) * 100 : 0
                return [
                    `<div style="font-weight:600;margin-bottom:4px">${point.date}</div>`,
                    `<div>营收：<span style="color:${revenueColor};font-weight:600">${formatCurrency(point.revenue)}</span></div>`,
                    `<div>运营利润：<span style="color:${profitColor};font-weight:600">${formatCurrency(point.profit)}</span> <span style="color:${axisColor}">(${marginPct.toFixed(1)}%)</span></div>`,
                    `<div style="margin-top:4px;color:${axisColor}">订单 ${point.orderCount}</div>`,
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
            // Revenue — top-line, light area fill so the gap between revenue and profit
            // visually conveys "deductions zone" without needing a separate cost line.
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
                areaStyle: {
                    color: revenueColor,
                    opacity: 0.08,
                },
                emphasis: { focus: "none", scale: 1.2 },
                z: 2,
            },
            // Operating profit — the bottom-line.
            {
                name: "运营利润",
                type: "line",
                smooth: true,
                showSymbol: false,
                symbol: "triangle",
                symbolSize: 9,
                data: data.map((d) => d.profit),
                lineStyle: { color: profitColor, width: 2.5 },
                itemStyle: { color: profitColor },
                areaStyle: {
                    color: profitColor,
                    opacity: 0.15,
                },
                emphasis: { focus: "none", scale: 1.2 },
                z: 3,
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
