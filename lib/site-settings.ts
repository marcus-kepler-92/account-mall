import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

// Runtime-resolved site settings. Each field returns the DB-stored value if
// the admin has explicitly set one, otherwise falls back to the env-derived
// config (smooth migration path: env stays authoritative until an admin
// overrides a field through /admin/settings/site).
//
// Returned shape is the materialized values consumed by callers — all
// non-nullable strings/numbers. `escalateWebhookUrl` remains optional because
// it's optional in env too.
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
}

// React `cache()` memoizes per request — multiple callers within the same
// server render or API request share one DB hit. Across requests the cache
// is reset, so admin PATCH is picked up on the next request without explicit
// invalidation.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
    const row = await prisma.siteSetting.findUnique({ where: { id: "singleton" } })
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
    }
})

// Returns the raw DB row (with explicit nulls for fields not yet overridden).
// Used by the admin settings page to distinguish "set to empty" from "using
// env fallback". Most callers should use getSiteSettings() instead.
export async function getSiteSettingRow() {
    return prisma.siteSetting.findUnique({ where: { id: "singleton" } })
}
