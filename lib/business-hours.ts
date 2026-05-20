import { getSiteSettings } from "@/lib/site-settings"

// Returns true when the current (or provided) instant falls within configured
// business hours. Reads from runtime SiteSettings (DB → env fallback).
//
// Start hour inclusive, end hour exclusive. Supports overnight windows where
// start > end (e.g. 22:00–09:00 covers late-night and pre-dawn).
export async function isInBusinessHours(now: Date = new Date()): Promise<boolean> {
    const settings = await getSiteSettings()
    return computeInBusinessHours(now, settings.businessHoursTimezone, settings.businessHoursStart, settings.businessHoursEnd)
}

// Pure helper exposed for unit testing without DB.
export function computeInBusinessHours(now: Date, timezone: string, start: number, end: number): boolean {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        hour12: false,
    }).formatToParts(now)
    const hourPart = parts.find((p) => p.type === "hour")
    if (!hourPart) return false
    const hour = Number(hourPart.value)
    if (start === end) return false
    if (start < end) return hour >= start && hour < end
    // overnight window: hour falls in [start, 24) or [0, end)
    return hour >= start || hour < end
}
