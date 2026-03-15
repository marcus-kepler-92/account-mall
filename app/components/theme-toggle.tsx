"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Monitor, Moon, Sun, Sunrise } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getSunriseSunsetTheme } from "@/lib/sunrise-sunset"

type ThemeMode = "system" | "sunrise-sunset"

const STORAGE_KEY = "theme-mode"

function getStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system"
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system"
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)

  useEffect(() => {
    if (mode === "sunrise-sunset") {
      setTheme(getSunriseSunsetTheme())
    } else {
      setTheme("system")
    }
    queueMicrotask(() => setMounted(true))
  }, [setTheme, mode])

  const handleSelect = (value: string) => {
    const next = value as ThemeMode
    setMode(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const isDark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9"
          aria-label="切换主题"
        >
          {mounted ? (
            isDark ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )
          ) : (
            <Sun className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          checked={mode === "system"}
          onCheckedChange={() => handleSelect("system")}
        >
          <Monitor className="size-4" />
          跟随系统
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={mode === "sunrise-sunset"}
          onCheckedChange={() => handleSelect("sunrise-sunset")}
        >
          <Sunrise className="size-4" />
          日出日落
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
