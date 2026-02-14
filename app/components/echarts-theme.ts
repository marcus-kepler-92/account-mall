"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

/**
 * 从当前文档的 CSS 变量读取颜色，供 ECharts 使用，避免图表全是黑灰色。
 * 在客户端读取，随主题（亮/暗）自动切换。
 */
function getCssVar(name: string): string {
    if (typeof document === "undefined") return ""
    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim()
    return value || ""
}

export function getEChartsThemeColors() {
    return {
        primary: getCssVar("--primary"),
        chart1: getCssVar("--chart-1"),
        chart2: getCssVar("--chart-2"),
        chart3: getCssVar("--chart-3"),
        chart4: getCssVar("--chart-4"),
        chart5: getCssVar("--chart-5"),
        foreground: getCssVar("--foreground"),
        mutedForeground: getCssVar("--muted-foreground"),
        border: getCssVar("--border"),
        popover: getCssVar("--popover"),
        popoverForeground: getCssVar("--popover-foreground"),
        background: getCssVar("--background"),
    }
}

/** ECharts 全局 textStyle、轴线、分割线等使用前景色，避免默认灰导致看不清 */
export function getEChartsBaseOption(colors: ReturnType<typeof getEChartsThemeColors>) {
    const textColor = colors.foreground || "#333"
    const axisColor = colors.border || colors.mutedForeground || "#999"
    return {
        backgroundColor: "transparent",
        textStyle: {
            color: textColor,
            fontFamily: "inherit",
        },
        grid: {
            left: "3%",
            right: "4%",
            bottom: "3%",
            top: "12%",
            containLabel: true,
        },
    }
}

/** 通用 tooltip 样式，与页面 popover 一致 */
export function getEChartsTooltip(colors: ReturnType<typeof getEChartsThemeColors>) {
    return {
        backgroundColor: colors.popover || "rgba(255,255,255,0.95)",
        borderColor: colors.border || "#eee",
        borderWidth: 1,
        textStyle: {
            color: colors.popoverForeground || colors.foreground || "#333",
        },
    }
}

/** 在客户端读取 CSS 变量，主题切换时更新，避免 ECharts 黑灰色 */
export function useEChartsTheme() {
    const { resolvedTheme } = useTheme()
    const [colors, setColors] = useState(getEChartsThemeColors)

    useEffect(() => {
        if (resolvedTheme === undefined) return
        // 延迟一帧再读 CSS 变量，确保 next-themes 已把新主题应用到 document
        const id = requestAnimationFrame(() => {
            setColors(getEChartsThemeColors())
        })
        return () => cancelAnimationFrame(id)
    }, [resolvedTheme])

    return colors
}
