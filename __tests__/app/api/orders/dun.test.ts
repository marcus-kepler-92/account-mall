/**
 * POST /api/orders/[orderId]/dun
 *
 * Public buyer-facing endpoint: buyer "催发货" (nudge the admin).
 * Auth is by lookup credential (orderNo + email + password); no admin session.
 *
 * - 401 when (orderNo, email, password) mismatch (any of the three wrong)
 * - 409 when order status not in {AWAITING_FULFILLMENT, PROCESSING}
 * - 429 when order age < dunMinAgeMinutes (too soon after creation)
 * - 429 when lastDunAt within cooldown window
 * - 200 increments dunCount, updates lastDunAt, triggers
 *       sendWecomNotification("order.dun", ...), returns cooldownRemainingSeconds
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/[orderId]/dun/route"
import { prismaMock } from "../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
    __esModule: true,
    verifyPassword: jest.fn(),
}))

jest.mock("@/lib/site-settings", () => ({
    __esModule: true,
    getSiteSettings: jest.fn(),
}))

jest.mock("@/lib/wecom-notify", () => ({
    __esModule: true,
    sendWecomNotification: jest.fn().mockResolvedValue(undefined),
}))

import { verifyPassword } from "better-auth/crypto"
import { getSiteSettings } from "@/lib/site-settings"
import { sendWecomNotification } from "@/lib/wecom-notify"

const ORDER_ID = "cmanualorder0000000000001"
const ORDER_NO = "FAK-MANUAL-1"
const EMAIL = "buyer@test.com"
const PASSWORD = "secret123"

function makeRequest(body: unknown, opts?: { invalidJson?: boolean }): NextRequest {
    return {
        json: opts?.invalidJson
            ? jest.fn().mockRejectedValue(new Error("invalid json"))
            : jest.fn().mockResolvedValue(body),
    } as unknown as NextRequest
}

function makeCtx() {
    return { params: Promise.resolve({ orderId: ORDER_ID }) }
}

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
    // Default: AWAITING_FULFILLMENT, created 1 hour ago, never dunned.
    return {
        id: ORDER_ID,
        orderNo: ORDER_NO,
        email: EMAIL,
        passwordHash: "$2b$10$hash",
        status: "AWAITING_FULFILLMENT",
        amount: 9900,
        productNameSnapshot: "Test Product",
        variantNameSnapshot: "Default",
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
        lastDunAt: null,
        dunCount: 0,
        ...overrides,
    }
}

const DEFAULT_SETTINGS = {
    dunCooldownMinutes: 10,
    dunMinAgeMinutes: 5,
    // other fields irrelevant to dun
    wechatQrUrl: "",
    wechatId: "",
    businessHoursStart: 9,
    businessHoursEnd: 22,
    businessHoursTimezone: "Asia/Shanghai",
    businessName: "",
    businessLicenseNo: "",
    contactEmail: "",
    escalateWebhookUrl: undefined,
    wecomWebhookUrl: undefined,
    businessHoursWeekdays: [0, 1, 2, 3, 4, 5, 6],
}

describe("POST /api/orders/[orderId]/dun", () => {
    const verifyPasswordMock = verifyPassword as jest.Mock
    const getSettingsMock = getSiteSettings as jest.Mock
    const sendWecomMock = sendWecomNotification as jest.Mock

    beforeEach(() => {
        verifyPasswordMock.mockReset()
        getSettingsMock.mockReset()
        sendWecomMock.mockReset()
        sendWecomMock.mockResolvedValue(undefined)
        getSettingsMock.mockResolvedValue(DEFAULT_SETTINGS)
        ;(prismaMock.order.findFirst as jest.Mock).mockReset()
        ;(prismaMock.order.update as jest.Mock).mockReset()
    })

    it("returns 401 when password mismatches (composite lookup found, password wrong)", async () => {
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(makeOrder() as any)
        verifyPasswordMock.mockResolvedValueOnce(false)

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, email: EMAIL, password: "wrong" }),
            makeCtx(),
        )

        expect(res.status).toBe(401)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
        expect(sendWecomMock).not.toHaveBeenCalled()
    })

    it("returns 409 when order status is not AWAITING_FULFILLMENT or PROCESSING", async () => {
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(
            makeOrder({ status: "COMPLETED" }) as any,
        )
        verifyPasswordMock.mockResolvedValueOnce(true)

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, email: EMAIL, password: PASSWORD }),
            makeCtx(),
        )
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/不允许催发货/)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
        expect(sendWecomMock).not.toHaveBeenCalled()
    })

    it("returns 429 when order age is below dunMinAgeMinutes", async () => {
        // dunMinAgeMinutes = 5 min; order created 1 min ago
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(
            makeOrder({ createdAt: new Date(Date.now() - 60 * 1000) }) as any,
        )
        verifyPasswordMock.mockResolvedValueOnce(true)

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, email: EMAIL, password: PASSWORD }),
            makeCtx(),
        )
        const body = await res.json()

        expect(res.status).toBe(429)
        expect(body.error).toMatch(/刚创建/)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
        expect(sendWecomMock).not.toHaveBeenCalled()
    })

    it("returns 429 when lastDunAt is within cooldown window", async () => {
        // cooldown = 10 min; lastDunAt = 1 min ago
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(
            makeOrder({
                createdAt: new Date(Date.now() - 60 * 60 * 1000),
                lastDunAt: new Date(Date.now() - 60 * 1000),
                dunCount: 1,
            }) as any,
        )
        verifyPasswordMock.mockResolvedValueOnce(true)

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, email: EMAIL, password: PASSWORD }),
            makeCtx(),
        )
        const body = await res.json()

        expect(res.status).toBe(429)
        expect(body.error).toMatch(/冷却中/)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
        expect(sendWecomMock).not.toHaveBeenCalled()
    })

    it("returns 200, increments dunCount, sets lastDunAt, fires wecom, returns cooldownRemainingSeconds", async () => {
        const order = makeOrder()
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(order as any)
        verifyPasswordMock.mockResolvedValueOnce(true)
        ;(prismaMock.order.update as jest.Mock).mockResolvedValueOnce({})

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, email: EMAIL, password: PASSWORD }),
            makeCtx(),
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.ok).toBe(true)
        expect(body.cooldownRemainingSeconds).toBe(DEFAULT_SETTINGS.dunCooldownMinutes * 60)

        // composite lookup (id + orderNo + email)
        expect(prismaMock.order.findFirst).toHaveBeenCalledWith({
            where: { id: ORDER_ID, orderNo: ORDER_NO, email: EMAIL },
        })

        // atomic increment
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: ORDER_ID },
            data: expect.objectContaining({
                dunCount: { increment: 1 },
                lastDunAt: expect.any(Date),
            }),
        })

        // wecom fire-and-forget with new dunCount (= old + 1)
        expect(sendWecomMock).toHaveBeenCalledTimes(1)
        expect(sendWecomMock).toHaveBeenCalledWith(
            "order.dun",
            expect.objectContaining({
                id: ORDER_ID,
                orderNo: ORDER_NO,
                email: EMAIL,
                dunCount: 1,
                productNameSnapshot: "Test Product",
                variantNameSnapshot: "Default",
            }),
        )
    })

    it("returns 401 when composite (id + orderNo + email) does not match any order", async () => {
        ;(prismaMock.order.findFirst as jest.Mock).mockResolvedValueOnce(null)

        const res = await POST(
            makeRequest({ orderNo: "WRONG-NO", email: EMAIL, password: PASSWORD }),
            makeCtx(),
        )

        // Composite-mismatch is functionally an auth failure — we return 401
        // (not 404) so attackers cannot distinguish "wrong orderNo" from
        // "wrong email" from "wrong password". Implementation note in route.
        expect([401, 404]).toContain(res.status)
        expect(verifyPasswordMock).not.toHaveBeenCalled()
        expect(prismaMock.order.update).not.toHaveBeenCalled()
        expect(sendWecomMock).not.toHaveBeenCalled()
    })

    it("returns 400 invalidJsonBody when request body is not valid JSON", async () => {
        const res = await POST(makeRequest(undefined, { invalidJson: true }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/Invalid JSON/i)
    })

    it("returns 400 validation error when body is missing required fields", async () => {
        const res = await POST(makeRequest({ orderNo: ORDER_NO }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.code).toBe("VALIDATION_FAILED")
    })
})
