"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const THEMES = ["light", "dark", "system"] as const
type Theme = (typeof THEMES)[number]

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    function cycle() {
        const idx = THEMES.indexOf((theme ?? "system") as Theme)
        setTheme(THEMES[(idx + 1) % THEMES.length])
    }

    const Icon = !mounted
        ? null
        : theme === "dark"
          ? Moon
          : theme === "light"
            ? Sun
            : Monitor

    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-9"
            aria-label="切换主题"
            onClick={cycle}
        >
            {Icon ? <Icon className="size-4" /> : <Sun className="size-4 opacity-0" aria-hidden />}
        </Button>
    )
}
