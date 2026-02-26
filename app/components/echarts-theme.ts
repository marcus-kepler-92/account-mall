"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

/**
 * Resolve a CSS variable to computed color (e.g. rgb/rgba). ECharts/Canvas does not
 * support oklch(), so we must resolve theme variables to a format they understand.
 */
function getComputedColor(cssVarName: string): string {
    if (typeof document === "undefined") return ""
    const el = document.createElement("div")
    el.style.setProperty("background", `var(${cssVarName})`)
    el.style.setProperty("border", "none")
    document.body.appendChild(el)
    const value = getComputedStyle(el).backgroundColor
    document.body.removeChild(el)
    return value || ""
}

export function getEChartsThemeColors() {
    return {
        primary: getComputedColor("--primary"),
        chart1: getComputedColor("--chart-1"),
        chart2: getComputedColor("--chart-2"),
        chart3: getComputedColor("--chart-3"),
        chart4: getComputedColor("--chart-4"),
        chart5: getComputedColor("--chart-5"),
        foreground: getComputedColor("--foreground"),
        mutedForeground: getComputedColor("--muted-foreground"),
        border: getComputedColor("--border"),
        popover: getComputedColor("--popover"),
        popoverForeground: getComputedColor("--popover-foreground"),
        background: getComputedColor("--background"),
    }
}

/** ECharts 全局 textStyle、轴线、分割线等使用前景色，避免默认灰导致看不清 */
export function getEChartsBaseOption(colors: ReturnType<typeof getEChartsThemeColors>) {
    const textColor = colors.foreground || "#333"
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
