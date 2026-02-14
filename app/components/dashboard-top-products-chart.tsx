"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import type { TopProductRow } from "@/app/admin/(main)/dashboard/types"
import { useTheme } from "next-themes"
import { useEChartsTheme, getEChartsTooltip } from "@/app/components/echarts-theme"

function truncateName(name: string, maxLen: number = 12) {
    if (name.length <= maxLen) return name
    return name.slice(0, maxLen - 1) + "…"
}

export function DashboardTopProductsChart({
    data,
}: {
    data: TopProductRow[]
    basePath?: string
}) {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const colors = useEChartsTheme()

    useEffect(() => {
        setMounted(true)
    }, [])
    const tooltipStyle = getEChartsTooltip(colors)
    const primary = colors.primary || "#5B8FF9"
    const axisColor = colors.mutedForeground || colors.foreground || "#666"

    const chartData = data.map((r) => ({
        name: truncateName(r.productName),
        fullName: r.productName,
        value: r.revenue,
        orderCount: r.orderCount,
    }))

    if (chartData.length === 0) {
        return (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                暂无销售数据
            </div>
        )
    }

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        tooltip: {
            ...tooltipStyle,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: unknown) => {
                const p = Array.isArray(params) ? params[0] : null
                if (!p || !("data" in p)) return ""
                const d = (p as { data: { fullName: string; value: number; orderCount: number } }).data
                if (!d || typeof d !== "object") return ""
                return `${d.fullName}<br/>营收: ¥${d.value.toFixed(2)}<br/>订单数: ${d.orderCount}`
            },
        },
        grid: { left: "3%", right: "12%", top: "4%", bottom: "4%", containLabel: true },
        xAxis: {
            type: "value",
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: colors.border, type: "dashed" } },
            axisLabel: { color: axisColor, formatter: (v: number) => `¥${v}` },
        },
        yAxis: {
            type: "category",
            data: chartData.map((d) => d.name),
            axisLine: { lineStyle: { color: axisColor } },
            axisTick: { show: false },
            axisLabel: { color: axisColor },
        },
        series: [
            {
                name: "营收",
                type: "bar",
                data: chartData,
                barMaxWidth: 20,
                itemStyle: { color: primary },
                encode: { x: "value", y: "name" },
            },
        ],
    }

    if (!mounted) {
        return <div className="h-[240px] w-full min-w-0" />
    }

    return (
        <div className="h-[240px] w-full min-w-0">
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
