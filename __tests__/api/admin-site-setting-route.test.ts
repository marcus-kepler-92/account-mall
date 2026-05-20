import { type NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
    prisma: {
        siteSetting: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
    },
}))

// Override the global jest.setup.ts mock with one that lets each test control
// what getSiteSettingRow / getSiteSettings return.
jest.mock("@/lib/site-settings", () => ({
    getSiteSettings: jest.fn(),
    getSiteSettingRow: jest.fn(),
}))

import { GET, PATCH } from "@/app/api/admin/site-setting/route"
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { getSiteSettings, getSiteSettingRow } from "@/lib/site-settings"

const adminSession = { user: { id: "admin_1" } }

const DEFAULT_EFFECTIVE = {
    wechatQrUrl: "https://env.example/qr.png",
    wechatId: "env_wechat",
    businessHoursStart: 9,
    businessHoursEnd: 22,
    businessHoursTimezone: "Asia/Shanghai",
    businessName: "",
    businessLicenseNo: "",
    contactEmail: "",
    escalateWebhookUrl: undefined,
} as const

function jsonRequest(body: unknown, parseError = false): NextRequest {
    return {
        json: () =>
            parseError ? Promise.reject(new Error("bad json")) : Promise.resolve(body),
    } as unknown as NextRequest
}

beforeEach(() => {
    jest.clearAllMocks()
    ;(getSiteSettings as jest.Mock).mockResolvedValue(DEFAULT_EFFECTIVE)
    ;(getSiteSettingRow as jest.Mock).mockResolvedValue(null)
})

describe("GET /api/admin/site-setting", () => {
    it("returns 401 when not authenticated", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(null)
        const res = await GET()
        expect(res.status).toBe(401)
    })

    it("returns row + effective when authenticated", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        ;(getSiteSettingRow as jest.Mock).mockResolvedValueOnce({
            id: "singleton",
            wechatId: "db_wechat",
        })
        const res = await GET()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.row).toMatchObject({ wechatId: "db_wechat" })
        expect(body.data.effective).toEqual(DEFAULT_EFFECTIVE)
    })

    it("returns row=null when no DB row exists", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        ;(getSiteSettingRow as jest.Mock).mockResolvedValueOnce(null)
        const res = await GET()
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.data.row).toBeNull()
    })
})

describe("PATCH /api/admin/site-setting", () => {
    it("returns 401 when not authenticated", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(null)
        const req = jsonRequest({ wechatId: "x" })
        const res = await PATCH(req)
        expect(res.status).toBe(401)
        expect(prisma.siteSetting.upsert).not.toHaveBeenCalled()
    })

    it("returns 400 for invalid JSON body", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        const req = jsonRequest(null, true)
        const res = await PATCH(req)
        expect(res.status).toBe(400)
        expect(prisma.siteSetting.upsert).not.toHaveBeenCalled()
    })

    it("rejects empty object with 400 + at-least-one-field detail", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        const req = jsonRequest({})
        const res = await PATCH(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.details.formErrors).toContain("至少需要修改一个字段")
        expect(prisma.siteSetting.upsert).not.toHaveBeenCalled()
    })

    it("rejects invalid URL with 400", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        const req = jsonRequest({ wechatQrUrl: "not-a-url" })
        const res = await PATCH(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.code).toBe("VALIDATION_FAILED")
        expect(prisma.siteSetting.upsert).not.toHaveBeenCalled()
    })

    it("rejects start === end with 400", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        const req = jsonRequest({ businessHoursStart: 10, businessHoursEnd: 10 })
        const res = await PATCH(req)
        expect(res.status).toBe(400)
        expect(prisma.siteSetting.upsert).not.toHaveBeenCalled()
    })

    it("upserts singleton on valid PATCH and returns 200", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        ;(prisma.siteSetting.upsert as jest.Mock).mockResolvedValueOnce({
            id: "singleton",
            wechatId: "new_wechat",
        })
        const req = jsonRequest({ wechatId: "new_wechat" })
        const res = await PATCH(req)
        expect(res.status).toBe(200)
        expect(prisma.siteSetting.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "singleton" },
                update: { wechatId: "new_wechat" },
                create: { id: "singleton", wechatId: "new_wechat" },
            }),
        )
    })

    it("converts empty-string fields to null on upsert (revert-to-env)", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        ;(prisma.siteSetting.upsert as jest.Mock).mockResolvedValueOnce({ id: "singleton" })
        const req = jsonRequest({ wechatId: "", businessName: "" })
        const res = await PATCH(req)
        expect(res.status).toBe(200)
        const call = (prisma.siteSetting.upsert as jest.Mock).mock.calls[0][0]
        expect(call.update).toEqual({ wechatId: null, businessName: null })
        expect(call.create).toEqual({ id: "singleton", wechatId: null, businessName: null })
    })

    it("coerces stringified hour numbers to integers", async () => {
        ;(getAdminSession as jest.Mock).mockResolvedValueOnce(adminSession)
        ;(prisma.siteSetting.upsert as jest.Mock).mockResolvedValueOnce({ id: "singleton" })
        const req = jsonRequest({ businessHoursStart: "8", businessHoursEnd: "23" })
        const res = await PATCH(req)
        expect(res.status).toBe(200)
        const call = (prisma.siteSetting.upsert as jest.Mock).mock.calls[0][0]
        expect(call.update).toEqual({ businessHoursStart: 8, businessHoursEnd: 23 })
    })
})
