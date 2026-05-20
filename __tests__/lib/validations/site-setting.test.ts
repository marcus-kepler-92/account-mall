import { siteSettingPatchSchema } from "@/lib/validations/site-setting"

describe("siteSettingPatchSchema — empty-string preprocess", () => {
    it("coerces '' to null for string fields (revert-to-env semantic)", () => {
        const r = siteSettingPatchSchema.safeParse({
            wechatQrUrl: "",
            wechatId: "",
            businessHoursTimezone: "",
            businessName: "",
            businessLicenseNo: "",
            contactEmail: "",
            escalateWebhookUrl: "",
        })
        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data.wechatQrUrl).toBeNull()
        expect(r.data.wechatId).toBeNull()
        expect(r.data.businessHoursTimezone).toBeNull()
        expect(r.data.businessName).toBeNull()
        expect(r.data.businessLicenseNo).toBeNull()
        expect(r.data.contactEmail).toBeNull()
        expect(r.data.escalateWebhookUrl).toBeNull()
    })

    it("coerces '' to null for hour fields", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: "",
            businessHoursEnd: "",
        })
        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data.businessHoursStart).toBeNull()
        expect(r.data.businessHoursEnd).toBeNull()
    })

    it("preserves whitespace-only string as null too", () => {
        const r = siteSettingPatchSchema.safeParse({ wechatId: "   " })
        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data.wechatId).toBeNull()
    })
})

describe("siteSettingPatchSchema — accepts valid values", () => {
    it("accepts a complete valid payload", () => {
        const r = siteSettingPatchSchema.safeParse({
            wechatQrUrl: "https://blob.vercel-storage.com/site-qr/x.png",
            wechatId: "shop_support",
            businessHoursStart: 9,
            businessHoursEnd: 22,
            businessHoursTimezone: "Asia/Shanghai",
            businessName: "Example Co",
            businessLicenseNo: "91110108MA01XYZ",
            contactEmail: "support@example.com",
            escalateWebhookUrl: "https://hooks.example.com/abc",
        })
        expect(r.success).toBe(true)
    })

    it("accepts partial PATCH (only one field)", () => {
        const r = siteSettingPatchSchema.safeParse({ wechatId: "new_id" })
        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data).toEqual({ wechatId: "new_id" })
    })

    it("accepts empty object (caller decides emptiness rejection)", () => {
        // The schema itself does not require at least one field; the API
        // route enforces that separately. Verify the schema layer is permissive.
        const r = siteSettingPatchSchema.safeParse({})
        expect(r.success).toBe(true)
    })

    it("coerces stringified hour numbers", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: "9",
            businessHoursEnd: "22",
        })
        expect(r.success).toBe(true)
        if (!r.success) return
        expect(r.data.businessHoursStart).toBe(9)
        expect(r.data.businessHoursEnd).toBe(22)
    })
})

describe("siteSettingPatchSchema — rejects invalid values", () => {
    it("rejects invalid URL for wechatQrUrl", () => {
        const r = siteSettingPatchSchema.safeParse({ wechatQrUrl: "not-a-url" })
        expect(r.success).toBe(false)
    })

    it("rejects invalid URL for escalateWebhookUrl", () => {
        const r = siteSettingPatchSchema.safeParse({ escalateWebhookUrl: "ftp://nope" })
        expect(r.success).toBe(false)
    })

    it("rejects malformed email", () => {
        const r = siteSettingPatchSchema.safeParse({ contactEmail: "no-at-sign" })
        expect(r.success).toBe(false)
    })

    it("rejects hour > 23", () => {
        const r = siteSettingPatchSchema.safeParse({ businessHoursStart: 24 })
        expect(r.success).toBe(false)
    })

    it("rejects negative hour", () => {
        const r = siteSettingPatchSchema.safeParse({ businessHoursStart: -1 })
        expect(r.success).toBe(false)
    })

    it("rejects non-integer hour", () => {
        const r = siteSettingPatchSchema.safeParse({ businessHoursStart: 9.5 })
        expect(r.success).toBe(false)
    })

    it("rejects start === end (both 10)", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: 10,
            businessHoursEnd: 10,
        })
        expect(r.success).toBe(false)
        if (r.success) return
        const issues = r.error.issues.map((i) => i.message)
        expect(issues).toContain("营业开始与结束小时不能相同")
    })

    it("allows start !== end (9 and 22)", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: 9,
            businessHoursEnd: 22,
        })
        expect(r.success).toBe(true)
    })

    it("allows overnight window (22 and 9)", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: 22,
            businessHoursEnd: 9,
        })
        expect(r.success).toBe(true)
    })

    it("does NOT enforce start !== end when one is null (partial PATCH)", () => {
        const r = siteSettingPatchSchema.safeParse({
            businessHoursStart: 10,
            // end omitted → no cross-field check possible, allow it
        })
        expect(r.success).toBe(true)
    })
})
