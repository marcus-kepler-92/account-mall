"use client"

import { cn } from "@/lib/utils"

/**
 * Shared sold-out overlay: theme-consistent overlay and badge.
 * Uses semantic colors (muted, foreground) for consistency across light/dark.
 */
export function SoldOutOverlay({
    className,
    badgePosition = "right-2 top-2",
}: {
    className?: string
    badgePosition?: string
} = {}) {
    return (
        <>
            <div
                className={cn("absolute inset-0 z-10 bg-muted/60", className)}
                aria-hidden
            />
            <span
                className={cn(
                    "absolute z-20 rounded-md bg-foreground/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-background shadow-sm",
                    badgePosition
                )}
                aria-label="售罄"
            >
                售罄
            </span>
        </>
    )
}
