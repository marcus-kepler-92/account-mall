"use client"

import { useEffect, useState } from "react"
import ReactECharts from "echarts-for-react"
import type { EChartsOption } from "echarts"
import type { OrderStatusCount } from "@/app/admin/(main)/dashboard/types"
import { useEChartsTheme, getEChartsTooltip } from "@/app/components/echarts-theme"

export function DashboardOrderStatusChart({ data }: { data: OrderStatusCount[] }) {
    const [mounted, setMounted] = useState(false)
    const filtered = data.filter((d) => d.count > 0)
    const colors = useEChartsTheme()

    useEffect(() => {
        setMounted(true)
    }, [])
    const tooltipStyle = getEChartsTooltip(colors)
    const palette = [colors.chart1, colors.chart2, colors.chart3].filter(Boolean)
    const defaultPalette = ["#5B8FF9", "#5AD8A6", "#5D7092"]
    const pieColors = palette.length >= 3 ? palette : defaultPalette

    if (filtered.length === 0) {
        return (
            <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                暂无订单数据
            </div>
        )
    }

    const option: EChartsOption = {
        backgroundColor: "transparent",
        textStyle: { color: colors.foreground, fontFamily: "inherit" },
        tooltip: {
            ...tooltipStyle,
            trigger: "item",
            formatter: "{b}: {c} 笔 ({d}%)",
        },
        legend: {
            orient: "vertical",
            right: 8,
            top: "center",
            textStyle: { color: colors.foreground },
        },
        series: [
            {
                name: "订单状态",
                type: "pie",
                radius: ["45%", "70%"],
                center: ["40%", "50%"],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderColor: colors.background || "#fff",
                    borderWidth: 2,
                },
                label: {
                    show: true,
                    color: colors.foreground,
                    formatter: "{b} {d}%",
                },
                emphasis: { label: { show: true } },
                data: filtered.map((d, i) => ({
                    value: d.count,
                    name: d.label,
                    itemStyle: { color: pieColors[i % pieColors.length] },
                })),
            },
        ],
    }

    if (!mounted) {
        return <div className="h-[240px] w-full min-w-0" />
    }

    return (
        <div className="h-[240px] w-full min-w-0">
            <ReactECharts
                option={option}
                style={{ height: "100%", width: "100%" }}
                opts={{ renderer: "canvas" }}
                notMerge
            />
        </div>
    )
}
