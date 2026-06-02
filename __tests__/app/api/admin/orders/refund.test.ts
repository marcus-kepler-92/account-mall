/**
 * POST /api/admin/orders/[orderId]/refund
 *
 * - 401 without admin session
 * - 404 when order not found
 * - 409 when order is not COMPLETED (only COMPLETED is refundable)
 * - 409 when order is not paid via 易支付 (no channel + yipay not configured)
 * - 503 when the provider refund call errors (returns null)
 * - 400 when the provider declines the refund (code != 1)
 * - 200 happy path: COMPLETED -> REFUNDED (+refundedAt) via updateMany guard,
 *   cancels commissions, revokes the inviter's milestone bonuses
 * - 200 path with no distributor: cancels commissions, skips milestone revoke
 * - 409 concurrent: updateMany count 0 leaves side effects un-run
 * - eligibility via env fallback (no channel but yipay configured) proceeds
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/admin/orders/[orderId]/refund/route"
import { prismaMock } from "../../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/yipay", () => ({
    __esModule: true,
    isYipayConfigured: jest.fn(),
    refundYipayOrder: jest.fn(),
}))

jest.mock("@/lib/domains/distributors", () => ({
    __esModule: true,
    cancelOrderCommissions: jest.fn().mockResolvedValue(undefined),
    revokeMilestoneBonusesForInviter: jest.fn().mockResolvedValue(undefined),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { isYipayConfigured, refundYipayOrder } from "@/lib/yipay"
import { cancelOrderCommissions, revokeMilestoneBonusesForInviter } from "@/lib/domains/distributors"

const ORDER_ID = "crefundorder000000000001"
const ADMIN_ID = "admin_1"
const DISTRIBUTOR_ID = "dist_1"
const INVITER_ID = "inv_1"

function makeRequest(): NextRequest {
    return {} as unknown as NextRequest
}

function makeCtx() {
    return { params: Promise.resolve({ orderId: ORDER_ID }) }
}

function makeOrder(
    status: "PENDING" | "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED" | "REFUNDED",
    overrides: Partial<Record<string, unknown>> = {},
) {
    return {
        id: ORDER_ID,
        orderNo: "FAK-REFUND-1",
        status,
        product: { productType: "NORMAL" },
        paymentChannel: { pid: "chan_pid", key: "chan_key", submitUrl: "https://chan.example.com/submit.php" },
        distributorId: DISTRIBUTOR_ID,
        amount: 99,
        ...overrides,
    }
}

function setupTxMock() {
    ;(prismaMock.$transaction as unknown as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
    )
}

describe("POST /api/admin/orders/[orderId]/refund", () => {
    const adminSessionMock = getAdminSession as jest.Mock
    const isYipayConfiguredMock = isYipayConfigured as jest.Mock
    const refundYipayMock = refundYipayOrder as jest.Mock
    const cancelCommissionsMock = cancelOrderCommissions as jest.Mock
    const revokeMilestoneMock = revokeMilestoneBonusesForInviter as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        isYipayConfiguredMock.mockReset()
        refundYipayMock.mockReset()
        cancelCommissionsMock.mockReset().mockResolvedValue(undefined)
        revokeMilestoneMock.mockReset().mockResolvedValue(undefined)
        ;(prismaMock.order.findUnique as jest.Mock).mockReset()
        ;(prismaMock.order.updateMany as jest.Mock).mockReset()
        ;(prismaMock.user.findUnique as jest.Mock).mockReset()
        ;(prismaMock.$transaction as unknown as jest.Mock).mockReset()
        // Default: COMPLETED order paid via a DB channel.
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        isYipayConfiguredMock.mockReturnValue(true)
    })

    it("returns 401 when no admin session", async () => {
        adminSessionMock.mockResolvedValue(null)

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(401)
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
        expect(refundYipayMock).not.toHaveBeenCalled()
    })

    it("returns 404 when order not found", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(null)

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(404)
        expect(refundYipayMock).not.toHaveBeenCalled()
    })

    it("returns 409 when order is not COMPLETED", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("PENDING") as any)

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/仅已完成订单可退款/)
        expect(refundYipayMock).not.toHaveBeenCalled()
    })

    it("is idempotent: already-REFUNDED order returns 200 without calling the provider", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("REFUNDED") as any)

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toEqual({ ok: true, alreadyRefunded: true })
        expect(refundYipayMock).not.toHaveBeenCalled()
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns a distinct actionable 500 (with orderNo) when provider succeeded but local reversal failed", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: true })
        ;(prismaMock.$transaction as unknown as jest.Mock).mockRejectedValueOnce(new Error("DB down"))

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(500)
        // Money is already out — the message must be actionable and name the order.
        expect(body.error).toMatch(/退款已在支付侧完成/)
        expect(body.error).toContain("FAK-REFUND-1")
        // Provider WAS called (money out); generic English 500 must NOT be used.
        expect(refundYipayMock).toHaveBeenCalledTimes(1)
        expect(body.error).not.toMatch(/Internal server error/)
    })

    it("returns 409 when order is not paid via 易支付 (no channel + yipay unconfigured)", async () => {
        isYipayConfiguredMock.mockReturnValue(false)
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(
            makeOrder("COMPLETED", { paymentChannel: null }) as any,
        )

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/不支持在线退款/)
        expect(refundYipayMock).not.toHaveBeenCalled()
    })

    it("returns 503 when the provider refund call errors (null)", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue(null)

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(503)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns 400 with provider message when refund is declined (code != 1)", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: false, message: "订单已退款" })

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/订单已退款/)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("refunds full amount and passes the DB channel credentials to the provider", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 })
        ;(prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce({ inviterId: INVITER_ID })

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toEqual({ ok: true })
        expect(refundYipayMock).toHaveBeenCalledWith("FAK-REFUND-1", "99.00", {
            pid: "chan_pid",
            key: "chan_key",
            submitUrl: "https://chan.example.com/submit.php",
        })
    })

    it("flips COMPLETED -> REFUNDED via updateMany guard, cancels commissions, revokes milestone bonuses", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 })
        ;(prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce({ inviterId: INVITER_ID })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        const updArg = (prismaMock.order.updateMany as jest.Mock).mock.calls[0][0]
        expect(updArg.where).toEqual({ id: ORDER_ID, status: "COMPLETED" })
        expect(updArg.data.status).toBe("REFUNDED")
        expect(updArg.data.refundedAt).toBeInstanceOf(Date)
        expect(cancelCommissionsMock).toHaveBeenCalledTimes(1)
        expect(cancelCommissionsMock.mock.calls[0][0]).toBe(ORDER_ID)
        expect(revokeMilestoneMock).toHaveBeenCalledTimes(1)
        expect(revokeMilestoneMock.mock.calls[0][1]).toBe(INVITER_ID)
    })

    it("cancels commissions but skips milestone revoke when order has no distributor", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(
            makeOrder("COMPLETED", { distributorId: null }) as any,
        )
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        expect(cancelCommissionsMock).toHaveBeenCalledTimes(1)
        expect(revokeMilestoneMock).not.toHaveBeenCalled()
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    })

    it("skips milestone revoke when the distributor has no inviter", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 })
        ;(prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce({ inviterId: null })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        expect(cancelCommissionsMock).toHaveBeenCalledTimes(1)
        expect(revokeMilestoneMock).not.toHaveBeenCalled()
    })

    it("returns 409 and runs no reversal when updateMany guard sees count 0 (concurrent refund)", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeOrder("COMPLETED") as any)
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 0 })

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/订单状态已变更/)
        expect(cancelCommissionsMock).not.toHaveBeenCalled()
        expect(revokeMilestoneMock).not.toHaveBeenCalled()
    })

    it("is eligible via env fallback when no DB channel but yipay is configured", async () => {
        isYipayConfiguredMock.mockReturnValue(true)
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(
            makeOrder("COMPLETED", { paymentChannel: null }) as any,
        )
        refundYipayMock.mockResolvedValue({ ok: true })
        setupTxMock()
        ;(prismaMock.order.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 })
        ;(prismaMock.user.findUnique as jest.Mock).mockResolvedValueOnce({ inviterId: null })

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(200)
        // No per-channel override -> provider call uses env credentials (undefined channel arg).
        expect(refundYipayMock).toHaveBeenCalledWith("FAK-REFUND-1", "99.00", undefined)
    })
})
