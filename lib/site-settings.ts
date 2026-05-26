import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

// Runtime-resolved site settings. Each field returns the DB-stored value if
// the admin has explicitly set one, otherwise falls back to the env-derived
// config (smooth migration path: env stays authoritative until an admin
// overrides a field through /admin/settings/site).
//
// Returned shape is the materialized values consumed by callers — all
// non-nullable strings/numbers. `escalateWebhookUrl` and `wecomWebhookUrl`
// remain optional because they're optional in env too. `businessHoursWeekdays`
// is always a resolved number[] (defaults to [0..6] if unset/malformed).
export type SiteSettings = {
    wechatQrUrl: string
    wechatId: string
    businessHoursStart: number
    businessHoursEnd: number
    businessHoursTimezone: string
    businessName: string
    businessLicenseNo: string
    contactEmail: string
    escalateWebhookUrl: string | undefined
    wecomWebhookUrl: string | undefined
    dunCooldownMinutes: number
    dunMinAgeMinutes: number
    businessHoursWeekdays: number[]
}

// React `cache()` memoizes per request — multiple callers within the same
// server render or API request share one DB hit. Across requests the cache
// is reset, so admin PATCH is picked up on the next request without explicit
// invalidation.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
    const row = await prisma.siteSetting.findUnique({ where: { id: "singleton" } })
    const weekdaysRaw = row?.businessHoursWeekdays ?? config.businessHoursWeekdays
    const weekdays = parseWeekdays(weekdaysRaw)
    return {
        wechatQrUrl: row?.wechatQrUrl ?? config.wechatQrUrl,
        wechatId: row?.wechatId ?? config.wechatId,
        businessHoursStart: row?.businessHoursStart ?? config.businessHoursStart,
        businessHoursEnd: row?.businessHoursEnd ?? config.businessHoursEnd,
        businessHoursTimezone: row?.businessHoursTimezone ?? config.businessHoursTimezone,
        businessName: row?.businessName ?? config.businessName,
        businessLicenseNo: row?.businessLicenseNo ?? config.businessLicenseNo,
        contactEmail: row?.contactEmail ?? config.contactEmail,
        escalateWebhookUrl: row?.escalateWebhookUrl ?? config.escalateWebhookUrl,
        wecomWebhookUrl: row?.wecomWebhookUrl ?? config.wecomWebhookUrl,
        dunCooldownMinutes: row?.dunCooldownMinutes ?? config.dunCooldownMinutes,
        dunMinAgeMinutes: row?.dunMinAgeMinutes ?? config.dunMinAgeMinutes,
        businessHoursWeekdays: weekdays,
    }
})

// Returns the raw DB row (with explicit nulls for fields not yet overridden).
// Used by the admin settings page to distinguish "set to empty" from "using
// env fallback". Most callers should use getSiteSettings() instead.
export async function getSiteSettingRow() {
    return prisma.siteSetting.findUnique({ where: { id: "singleton" } })
}

// Parse the `businessHoursWeekdays` JSON-array string into a clean number[].
// Returns the full week ([0..6]) for any of: missing value, non-JSON text,
// non-array JSON, or array whose integers all fall outside 0–6. Out-of-range
// elements inside an otherwise valid array are silently dropped.
function parseWeekdays(raw: string | undefined | null): number[] {
    if (!raw) return [0, 1, 2, 3, 4, 5, 6]
    try {
        const arr = JSON.parse(raw)
        if (!Array.isArray(arr)) return [0, 1, 2, 3, 4, 5, 6]
        const cleaned = arr.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        return cleaned.length > 0 ? cleaned : [0, 1, 2, 3, 4, 5, 6]
    } catch {
        return [0, 1, 2, 3, 4, 5, 6]
    }
}
