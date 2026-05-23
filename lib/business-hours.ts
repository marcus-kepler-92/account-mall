import { formatInTimeZone, toDate } from "date-fns-tz"
import { addDays } from "date-fns"
import { getSiteSettings } from "@/lib/site-settings"

// Timezone-aware business-hours window with optional weekday restriction and
// cross-night support (end <= start means the window wraps past midnight).
// Hours are inclusive of `start`, exclusive of `end`.
export type BusinessHoursConfig = {
    start: number          // hour 0-23
    end: number            // hour 0-23; end <= start means cross-night
    weekdays: number[]     // 0=Sun, 6=Sat
    timezone: string       // IANA tz, e.g. "Asia/Shanghai"
}

// Decompose a UTC instant into its zoned calendar parts (hour, weekday, ymd).
// `i` in `formatInTimeZone` is ISO day-of-week (1=Mon..7=Sun); we normalize to
// the JS Date.getDay() convention (0=Sun..6=Sat) for caller convenience.
// `e` is intentionally NOT used — its numbering is locale-dependent.
function getZonedParts(date: Date, tz: string): { hour: number; weekday: number; year: number; month: number; day: number } {
    const formatted = formatInTimeZone(date, tz, "yyyy-MM-dd HH i")
    const [ymd, hour, iDay] = formatted.split(" ")
    const [y, m, d] = ymd.split("-").map(Number)
    const isoWeekday = Number(iDay)
    const weekday = isoWeekday === 7 ? 0 : isoWeekday
    return { hour: Number(hour), weekday, year: y, month: m, day: d }
}

function isCrossNight(cfg: BusinessHoursConfig): boolean {
    return cfg.end <= cfg.start
}

function pad(n: number): string {
    return n.toString().padStart(2, "0")
}

// Whether `now` falls inside the configured business-hours window.
// Cross-night case (end <= start): a window opened on a listed weekday spans
// into the pre-dawn hours of the FOLLOWING calendar day, regardless of whether
// that next day itself is in `weekdays`.
export function isWithinBusinessHours(now: Date, cfg: BusinessHoursConfig): boolean {
    const { hour, weekday } = getZonedParts(now, cfg.timezone)
    if (isCrossNight(cfg)) {
        // hour ∈ [start, 24) on a listed weekday  OR  hour ∈ [0, end) where the
        // previous calendar day in tz is a listed weekday.
        if (hour >= cfg.start && cfg.weekdays.includes(weekday)) return true
        if (hour < cfg.end) {
            const prevWeekday = (weekday + 6) % 7
            if (cfg.weekdays.includes(prevWeekday)) return true
        }
        return false
    }
    return cfg.weekdays.includes(weekday) && hour >= cfg.start && hour < cfg.end
}

// The next instant at which a business-hours window opens. Returns `now`
// unchanged when already in-window. Walks day-by-day in the configured tz to
// find the next allowed weekday whose `start` hour is still in the future.
// Throws after 14 days as a defensive cap — `weekdays` is guaranteed non-empty
// by the site-settings parser, so a window should always be found within 7.
export function nextWindowStart(now: Date, cfg: BusinessHoursConfig): Date {
    if (isWithinBusinessHours(now, cfg)) return now
    let probe = now
    for (let i = 0; i < 14; i++) {
        const { hour, weekday, year, month, day } = getZonedParts(probe, cfg.timezone)
        if (cfg.weekdays.includes(weekday)) {
            // If today is allowed but we're already past the start hour and yet
            // not in-window (window closed for the day), skip to tomorrow.
            if (i === 0 && hour >= cfg.start) {
                probe = addDays(probe, 1)
                continue
            }
            return toDate(`${year}-${pad(month)}-${pad(day)}T${pad(cfg.start)}:00:00`, { timeZone: cfg.timezone })
        }
        probe = addDays(probe, 1)
    }
    throw new Error("nextWindowStart: no upcoming window in 14 days")
}

// Human-readable ETA line for buyer-facing UI. In-window: reassure with a
// "通常在 ..." promise. Out-of-window: state the next window opening in zoned
// local time so the buyer knows when to expect fulfillment.
export function formatEtaText(now: Date, cfg: BusinessHoursConfig): string {
    if (isWithinBusinessHours(now, cfg)) return "卖家通常在 15 分钟内发货"
    const next = nextWindowStart(now, cfg)
    const human = formatInTimeZone(next, cfg.timezone, "M 月 d 日 HH:mm")
    return `非工作时间，卖家将在 ${human} 后处理`
}

// ---------------------------------------------------------------------------
// Legacy API — kept for backward compatibility with lib/agent-cs.ts which
// only needs an "is it business hours right now?" check without weekday data.
// New code should prefer isWithinBusinessHours() with a full BusinessHoursConfig.
// ---------------------------------------------------------------------------

// Returns true when the current (or provided) instant falls within configured
// business hours, reading from runtime SiteSettings (DB → env fallback).
export async function isInBusinessHours(now: Date = new Date()): Promise<boolean> {
    const settings = await getSiteSettings()
    return computeInBusinessHours(now, settings.businessHoursTimezone, settings.businessHoursStart, settings.businessHoursEnd)
}

// Pure hour-only window check (no weekday filter). Exposed for unit testing
// without DB. Start hour inclusive, end hour exclusive. Supports overnight
// windows where start > end (e.g. 22:00–09:00).
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
