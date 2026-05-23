// Unmock the global stub from jest.setup.ts so we can exercise the actual
// DB → env fallback logic in lib/site-settings.ts.
jest.unmock("@/lib/site-settings")

jest.mock("@/lib/prisma", () => ({
    prisma: {
        siteSetting: {
            findUnique: jest.fn(),
        },
    },
}))

jest.mock("@/lib/config", () => ({
    config: {
        wechatQrUrl: "https://env.example/qr.png",
        wechatId: "env_wechat",
        businessHoursStart: 9,
        businessHoursEnd: 22,
        businessHoursTimezone: "Asia/Shanghai",
        businessName: "env-shop",
        businessLicenseNo: "env-license-123",
        contactEmail: "env@example.com",
        escalateWebhookUrl: undefined,
        wecomWebhookUrl: undefined,
        dunCooldownMinutes: 30,
        dunMinAgeMinutes: 5,
        businessHoursWeekdays: undefined,
    },
}))

import { prisma } from "@/lib/prisma"
import { getSiteSettings, getSiteSettingRow } from "@/lib/site-settings"

const findUnique = prisma.siteSetting.findUnique as jest.Mock

beforeEach(() => {
    jest.clearAllMocks()
})

describe("getSiteSettings — env fallback", () => {
    it("returns env defaults when no DB row exists", async () => {
        findUnique.mockResolvedValueOnce(null)
        const s = await getSiteSettings()
        expect(s).toEqual({
            wechatQrUrl: "https://env.example/qr.png",
            wechatId: "env_wechat",
            businessHoursStart: 9,
            businessHoursEnd: 22,
            businessHoursTimezone: "Asia/Shanghai",
            businessName: "env-shop",
            businessLicenseNo: "env-license-123",
            contactEmail: "env@example.com",
            escalateWebhookUrl: undefined,
            wecomWebhookUrl: undefined,
            dunCooldownMinutes: 30,
            dunMinAgeMinutes: 5,
            businessHoursWeekdays: [0, 1, 2, 3, 4, 5, 6],
        })
        expect(findUnique).toHaveBeenCalledWith({ where: { id: "singleton" } })
    })

    it("uses DB values when row fields are non-null", async () => {
        findUnique.mockResolvedValueOnce({
            id: "singleton",
            wechatQrUrl: "https://blob.example/site-qr/abc.png",
            wechatId: "db_wechat",
            businessHoursStart: 8,
            businessHoursEnd: 23,
            businessHoursTimezone: "America/Los_Angeles",
            businessName: "db-shop",
            businessLicenseNo: "db-license",
            contactEmail: "db@example.com",
            escalateWebhookUrl: "https://hooks.example/notify",
            wecomWebhookUrl: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc",
            dunCooldownMinutes: 15,
            dunMinAgeMinutes: 10,
            businessHoursWeekdays: "[1,2,3,4,5]",
        })
        const s = await getSiteSettings()
        expect(s.wechatQrUrl).toBe("https://blob.example/site-qr/abc.png")
        expect(s.wechatId).toBe("db_wechat")
        expect(s.businessHoursStart).toBe(8)
        expect(s.businessHoursEnd).toBe(23)
        expect(s.businessHoursTimezone).toBe("America/Los_Angeles")
        expect(s.businessName).toBe("db-shop")
        expect(s.businessLicenseNo).toBe("db-license")
        expect(s.contactEmail).toBe("db@example.com")
        expect(s.escalateWebhookUrl).toBe("https://hooks.example/notify")
        expect(s.wecomWebhookUrl).toBe("https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc")
        expect(s.dunCooldownMinutes).toBe(15)
        expect(s.dunMinAgeMinutes).toBe(10)
        expect(s.businessHoursWeekdays).toEqual([1, 2, 3, 4, 5])
    })

    it("falls back per-field when DB row has nulls", async () => {
        findUnique.mockResolvedValueOnce({
            id: "singleton",
            wechatQrUrl: "https://blob.example/qr.png",
            wechatId: null,
            businessHoursStart: 10,
            businessHoursEnd: null,
            businessHoursTimezone: null,
            businessName: null,
            businessLicenseNo: null,
            contactEmail: "db@example.com",
            escalateWebhookUrl: null,
            wecomWebhookUrl: null,
            dunCooldownMinutes: null,
            dunMinAgeMinutes: null,
            businessHoursWeekdays: null,
        })
        const s = await getSiteSettings()
        // DB-set fields keep DB value
        expect(s.wechatQrUrl).toBe("https://blob.example/qr.png")
        expect(s.businessHoursStart).toBe(10)
        expect(s.contactEmail).toBe("db@example.com")
        // null fields fall back to env
        expect(s.wechatId).toBe("env_wechat")
        expect(s.businessHoursEnd).toBe(22)
        expect(s.businessHoursTimezone).toBe("Asia/Shanghai")
        expect(s.businessName).toBe("env-shop")
        expect(s.businessLicenseNo).toBe("env-license-123")
        expect(s.escalateWebhookUrl).toBeUndefined()
        expect(s.wecomWebhookUrl).toBeUndefined()
        expect(s.dunCooldownMinutes).toBe(30)
        expect(s.dunMinAgeMinutes).toBe(5)
        expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it("treats businessHoursStart=0 as a real value, not null fallback", async () => {
        // Regression guard: nullish coalescing must not swallow 0
        findUnique.mockResolvedValueOnce({
            businessHoursStart: 0,
            businessHoursEnd: 8,
            businessHoursTimezone: null,
            wechatQrUrl: null,
            wechatId: null,
            businessName: null,
            businessLicenseNo: null,
            contactEmail: null,
            escalateWebhookUrl: null,
        })
        const s = await getSiteSettings()
        expect(s.businessHoursStart).toBe(0)
        expect(s.businessHoursEnd).toBe(8)
    })
})

describe("getSiteSettings — businessHoursWeekdays parsing", () => {
    it("returns defaults [0..6] when businessHoursWeekdays unset", async () => {
        findUnique.mockResolvedValueOnce(null)
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it("parses JSON-encoded weekdays", async () => {
        findUnique.mockResolvedValueOnce({ businessHoursWeekdays: "[1,2,3,4,5]" })
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([1, 2, 3, 4, 5])
    })

    it("falls back to defaults on malformed JSON", async () => {
        findUnique.mockResolvedValueOnce({ businessHoursWeekdays: "not-json" })
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it("falls back to defaults when JSON parses to a non-array", async () => {
        findUnique.mockResolvedValueOnce({ businessHoursWeekdays: '{"mon":true}' })
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it("falls back to defaults when array contains only out-of-range ints", async () => {
        findUnique.mockResolvedValueOnce({ businessHoursWeekdays: "[7,8,-1]" })
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([0, 1, 2, 3, 4, 5, 6])
    })

    it("filters out-of-range ints while keeping valid ones", async () => {
        findUnique.mockResolvedValueOnce({ businessHoursWeekdays: "[0,3,9,-1,6]" })
        const s = await getSiteSettings()
        expect(s.businessHoursWeekdays).toEqual([0, 3, 6])
    })
})

describe("getSiteSettingRow", () => {
    it("returns the raw row (null when missing)", async () => {
        findUnique.mockResolvedValueOnce(null)
        expect(await getSiteSettingRow()).toBeNull()
    })

    it("returns the raw row when present", async () => {
        const row = { id: "singleton", wechatQrUrl: "x", wechatId: null }
        findUnique.mockResolvedValueOnce(row)
        expect(await getSiteSettingRow()).toEqual(row)
    })
})
