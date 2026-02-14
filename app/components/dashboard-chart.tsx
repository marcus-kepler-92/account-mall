"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import type { DashboardTrendPoint } from "@/app/admin/(main)/dashboard/types"
import { useEChartsTheme, getEChartsTooltip } from "@/app/components/echarts-theme"

export function DashboardChart({
    data,
}: {
    data: DashboardTrendPoint[]
    title?: string
}) {
    const [mounted, setMounted] = useState(false)
    const colors = useEChartsTheme()

    useEffect(() => {
        setMounted(true)
    }, [])
    const tooltipStyle = getEChartsTooltip(colors)
    const primary = colors.primary || "#5B8FF9"
    const chart2 = colors.chart2 || "#5AD8A6"
    const axisColor = colors.mutedForeground || colors.foreground || "#666"

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
                const d = (p as { data: { date?: string; 订单?: number; 营收?: number } }).data
                if (!d) return ""
                const date = d.date ?? ""
                const orders = Number(d.订单 ?? 0)
                const revenue = Number(d.营收 ?? 0)
                return `${date}<br/>订单数: ${orders}<br/>营收: ¥${revenue.toFixed(2)}`
            },
        },
        legend: {
            data: ["订单数", "营收"],
            textStyle: { color: colors.foreground },
            top: 0,
        },
        grid: { left: "3%", right: "12%", top: "15%", bottom: "3%", containLabel: true },
        xAxis: {
            type: "category",
            data: data.map((d) => d.date),
            axisLine: { lineStyle: { color: axisColor } },
            axisLabel: { color: axisColor },
        },
        yAxis: [
            {
                type: "value",
                name: "订单数",
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: colors.border, type: "dashed" } },
                axisLabel: { color: axisColor },
                nameTextStyle: { color: axisColor },
            },
            {
                type: "value",
                name: "营收",
                position: "right",
                axisLine: { show: false },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: { color: axisColor, formatter: (v: number) => `¥${v}` },
                nameTextStyle: { color: axisColor },
            },
        ],
        series: [
            {
                name: "订单数",
                type: "bar",
                data: data.map((d) => d.订单),
                itemStyle: { color: chart2 },
                barMaxWidth: 24,
            },
            {
                name: "营收",
                type: "line",
                yAxisIndex: 1,
                data: data.map((d) => d.营收),
                smooth: true,
                lineStyle: { color: primary },
                itemStyle: { color: primary },
                areaStyle: { color: primary, opacity: 0.2 },
            },
        ],
    }

    if (!mounted) {
        return <div className="h-[280px] w-full min-w-0" />
    }

    return (
        <div className="h-[280px] w-full min-w-0">
            <ReactECharts
                option={option}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
            />
        </div>
    )
}
