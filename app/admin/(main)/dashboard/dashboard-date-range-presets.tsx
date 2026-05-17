"use client"

import { useState } from "react"
import { CalendarDays, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  getDashboardDateRangePresets,
  todayHKT,
  type DashboardDateRangePreset,
} from "./dashboard-hkt"

type Props = {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  className?: string
}

type OptionKey = "today" | "yesterday" | "week" | "month" | "custom"

const OPTIONS: { key: OptionKey; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
  { key: "custom", label: "自定义" },
]

function getPresetKey(
  from: string,
  to: string,
  presets: DashboardDateRangePreset[]
): OptionKey | null {
  const labels: Record<string, OptionKey> = {
    "今日": "today",
    "昨日": "yesterday",
    "本周": "week",
    "本月": "month",
  }
  const matched = presets.find((p) => p.from === from && p.to === to)
  return matched ? (labels[matched.label] ?? null) : null
}

export function DashboardDateRangePresets({
  from,
  to,
  onChange,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const presets = getDashboardDateRangePresets()
  const today = todayHKT()

  const activeKey = getPresetKey(from, to, presets)
  const [mode, setMode] = useState<OptionKey>(activeKey ?? "custom")

  const displayLabel = OPTIONS.find((o) => o.key === mode)?.label ?? "今日"

  const handleSelect = (key: OptionKey) => {
    setMode(key)
    if (key === "custom") return
    const preset = presets.find(
      (p) => p.label === OPTIONS.find((o) => o.key === key)?.label
    )
    if (preset) {
      onChange(preset.from, preset.to)
      setOpen(false)
    }
  }

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">时间范围</span>
        <span className="text-sm font-medium">
          {from === to ? from : `${from} – ${to}`}
        </span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 font-normal"
          >
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span className="text-sm">{displayLabel}</span>
          </Button>
        </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex flex-col py-1">
          {OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={cn(
                "flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-accent",
                mode === key && "font-medium"
              )}
              onClick={() => handleSelect(key)}
            >
              {label}
              {mode === key && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
        {mode === "custom" && (
          <div className="border-t px-3 py-3">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={from}
                max={to}
                className="h-7 flex-1 px-2 text-xs"
                onChange={(e) => {
                  if (e.target.value && e.target.value <= to)
                    onChange(e.target.value, to)
                }}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={to}
                min={from}
                max={today}
                className="h-7 flex-1 px-2 text-xs"
                onChange={(e) => {
                  if (e.target.value && e.target.value >= from)
                    onChange(from, e.target.value)
                }}
              />
            </div>
          </div>
        )}
      </PopoverContent>
      </Popover>
    </div>
  )
}
