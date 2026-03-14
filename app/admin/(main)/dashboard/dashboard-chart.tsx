"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import type { DashboardTrendPoint } from "./types"
import { useTheme } from "next-themes"
import { useEChartsTheme, getEChartsTooltip } from "./echarts-theme"

export function DashboardChart({
    data,
}: {
    data: DashboardTrendPoint[]
    title?: string
}) {
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const colors = useEChartsTheme()

    useEffect(() => {
        queueMicrotask(() => setMounted(true))
    }, [])
    const tooltipStyle = getEChartsTooltip(colors)
    const primary = colors.primary || "#5B8FF9"
    const chart2 = colors.chart2 || "#5AD8A6"
    const chart3 = colors.chart3 || "#F6BD16"
    const axisColor = colors.mutedForeground || colors.foreground || "#666"

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        tooltip: {
            ...tooltipStyle,
            trigger: "axis",
            axisPointer: { type: "shadow" },
            formatter: (params: unknown) => {
                if (!Array.isArray(params) || params.length === 0) return ""
                const allParams = params as Array<{ seriesName?: string; value?: number; color?: string; dataIndex?: number }>
                const date = data[allParams[0]?.dataIndex ?? 0]?.date ?? ""
                const lines = allParams.map((p) => {
                    const val = Number(p.value ?? 0)
                    const isRevenue = p.seriesName === "营收" || p.seriesName === "净收入"
                    return `<span style="display:inline-block;margin-right:4px;border-radius:50%;width:10px;height:10px;background:${p.color}"></span>${p.seriesName}: ${isRevenue ? `¥${val.toFixed(2)}` : val}`
                })
                return `${date}<br/>${lines.join("<br/>")}`
            },
        },
        legend: {
            data: ["订单数", "营收", "净收入"],
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
                emphasis: {
                    itemStyle: { color: chart2 },
                },
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
                emphasis: {
                    lineStyle: { color: primary, width: 3 },
                    itemStyle: { color: primary },
                    areaStyle: { color: primary, opacity: 0.3 },
                },
            },
            {
                name: "净收入",
                type: "line",
                yAxisIndex: 1,
                data: data.map((d) => d.净收入),
                smooth: true,
                lineStyle: { color: chart3, type: "dashed", width: 2 },
                itemStyle: { color: chart3 },
                emphasis: {
                    lineStyle: { color: chart3, width: 3 },
                    itemStyle: { color: chart3 },
                },
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
