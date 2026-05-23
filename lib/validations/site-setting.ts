import { z } from "zod"

// All fields optional + nullable: PATCH body only carries fields the admin
// actually changed. Empty string ("") from a cleared form input means
// "revert to env fallback" → coerced to null.
const emptyToNull = (v: unknown) =>
    typeof v === "string" && v.trim() === "" ? null : v

const httpUrl = (msg: string) =>
    z.string().url(msg).refine((v) => /^https?:\/\//i.test(v), msg)

export const siteSettingPatchSchema = z.object({
    wechatQrUrl: z.preprocess(emptyToNull, httpUrl("二维码 URL 格式无效（需 http/https）").nullable()).optional(),
    wechatId: z.preprocess(emptyToNull, z.string().min(1).max(64).nullable()).optional(),
    businessHoursStart: z.preprocess(
        (v) => (v === "" || v === null ? null : v),
        z.coerce.number().int().min(0).max(23).nullable(),
    ).optional(),
    businessHoursEnd: z.preprocess(
        (v) => (v === "" || v === null ? null : v),
        z.coerce.number().int().min(0).max(23).nullable(),
    ).optional(),
    businessHoursTimezone: z.preprocess(emptyToNull, z.string().min(1).max(64).nullable()).optional(),
    businessName: z.preprocess(emptyToNull, z.string().max(128).nullable()).optional(),
    businessLicenseNo: z.preprocess(emptyToNull, z.string().max(64).nullable()).optional(),
    contactEmail: z.preprocess(emptyToNull, z.string().email("邮箱格式无效").nullable()).optional(),
    escalateWebhookUrl: z.preprocess(emptyToNull, httpUrl("Webhook URL 格式无效（需 http/https）").nullable()).optional(),
    wecomWebhookUrl: z.preprocess(emptyToNull, httpUrl("企微 webhook URL 格式无效").nullable()).optional(),
    dunCooldownMinutes: z.preprocess(
        (v) => (v === "" || v === null ? null : v),
        z.coerce.number().int().min(0).max(1440).nullable(),
    ).optional(),
    dunMinAgeMinutes: z.preprocess(
        (v) => (v === "" || v === null ? null : v),
        z.coerce.number().int().min(0).max(60).nullable(),
    ).optional(),
    businessHoursWeekdays: z.preprocess(
        emptyToNull,
        z.string().nullable().refine((v) => {
            if (v === null) return true
            try {
                const arr = JSON.parse(v)
                return Array.isArray(arr) && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 6)
            } catch { return false }
        }, "工作日字段必须是 0-6 整数 JSON 数组"),
    ).optional(),
})
.refine(
    (data) => {
        if (data.businessHoursStart == null || data.businessHoursEnd == null) return true
        return data.businessHoursStart !== data.businessHoursEnd
    },
    { message: "营业开始与结束小时不能相同", path: ["businessHoursEnd"] },
)

export type SiteSettingPatchInput = z.infer<typeof siteSettingPatchSchema>
