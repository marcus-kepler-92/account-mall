"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getDashboardDateRangePresets,
  type DashboardDateRangePreset,
} from "./dashboard-hkt"

type Props = {
  from: string
  to: string
  onPresetSelect: (preset: DashboardDateRangePreset) => void
  className?: string
  children?: ReactNode
}

export function DashboardDateRangePresets({
  from,
  to,
  onPresetSelect,
  className,
  children,
}: Props) {
  const presets = getDashboardDateRangePresets()
  const selectedLabel =
    presets.find((p) => p.from === from && p.to === to)?.label ?? ""

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground">时间范围</span>
      {presets.map((preset) => (
        <Button
          key={preset.label}
          type="button"
          variant={selectedLabel === preset.label ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onPresetSelect(preset)}
        >
          {preset.label}
        </Button>
      ))}
      {children}
    </div>
  )
}
