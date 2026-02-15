"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

type ThemeToggleProps = React.ComponentProps<typeof Button> & {
    showLabel?: boolean
}

export function ThemeToggle({ showLabel, ...props }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const isDark = theme === "dark"
    const handleToggle = () => {
        if (mounted) setTheme(isDark ? "light" : "dark")
    }

    return (
        <Button
            variant="ghost"
            size={showLabel ? "sm" : "icon"}
            className={showLabel ? "" : "size-9"}
            onClick={handleToggle}
            aria-label="切换主题"
            {...props}
        >
            {mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <Sun className="size-4" />}
            {showLabel && <span>切换主题</span>}
        </Button>
    )
}
