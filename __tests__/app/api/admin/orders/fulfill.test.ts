/**
 * POST /api/admin/orders/[orderId]/fulfill
 *
 * - 401 without admin session
 * - 400 (validationError) when content empty / > 5000 chars
 * - 409 when order is already COMPLETED/CLOSED/PENDING
 * - 200 transitions AWAITING_FULFILLMENT/PROCESSING -> COMPLETED, creates OrderFulfillment,
 *   calls createOrderCommissions + checkAndIssueMilestoneBonuses, fires sendOrderCompletionEmail
 * - 409 on second (idempotent) call when OrderFulfillment.orderId unique violation (P2002)
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/admin/orders/[orderId]/fulfill/route"
import { prismaMock } from "../../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/calculate-order-commission", () => ({
    __esModule: true,
    createOrderCommissions: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/domains/distributors", () => ({
    __esModule: true,
    checkAndIssueMilestoneBonuses: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/order-completion-email", () => ({
    __esModule: true,
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { createOrderCommissions } from "@/lib/calculate-order-commission"
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors"
import { sendOrderCompletionEmail } from "@/lib/order-completion-email"

const PRODUCT_ID = "cmanualproduct000000000001"
const ORDER_ID = "cmanualorder0000000000001"
const ADMIN_ID = "admin_1"
const DISTRIBUTOR_ID = "dist_1"

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

function makeManualOrder(
    status: "PENDING" | "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED",
    overrides: Partial<Record<string, unknown>> = {},
) {
    return {
        id: ORDER_ID,
        orderNo: "FAK-MANUAL-1",
        status,
        productId: PRODUCT_ID,
        product: { productType: "MANUAL" },
        distributorId: DISTRIBUTOR_ID,
        email: "buyer@test.com",
        amount: 9900,
        discountPercentApplied: 0,
        paidAt: new Date("2026-01-01T00:00:00Z"),
        ...overrides,
    }
}

function setupTxMock() {
    // Make $transaction(callback) actually execute the callback with prismaMock as the tx.
    ;(prismaMock.$transaction as unknown as jest.Mock).mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => {
        return cb(prismaMock)
    })
}

describe("POST /api/admin/orders/[orderId]/fulfill", () => {
    const adminSessionMock = getAdminSession as jest.Mock
    const createCommissionsMock = createOrderCommissions as jest.Mock
    const checkMilestoneMock = checkAndIssueMilestoneBonuses as jest.Mock
    const sendEmailMock = sendOrderCompletionEmail as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        createCommissionsMock.mockReset()
        checkMilestoneMock.mockReset()
        sendEmailMock.mockReset()
        createCommissionsMock.mockResolvedValue(undefined)
        checkMilestoneMock.mockResolvedValue(undefined)
        sendEmailMock.mockResolvedValue(undefined)
        ;(prismaMock.order.findUnique as jest.Mock).mockReset()
        ;(prismaMock.order.update as jest.Mock).mockReset()
        ;(prismaMock.orderFulfillment.create as jest.Mock).mockReset()
        ;(prismaMock.$transaction as unknown as jest.Mock).mockReset()
    })

    it("returns 401 when no admin session", async () => {
        adminSessionMock.mockResolvedValue(null)

        const res = await POST(makeRequest({ content: "Account: a@b / 123" }), makeCtx())

        expect(res.status).toBe(401)
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
        expect(prismaMock.orderFulfillment.create).not.toHaveBeenCalled()
    })

    it("returns 400 (validation error) when content is empty", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })

        const res = await POST(makeRequest({ content: "" }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.code).toBe("VALIDATION_FAILED")
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
    })

    it("returns 400 (validation error) when content exceeds 5000 chars", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })

        const res = await POST(makeRequest({ content: "x".repeat(5001) }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.code).toBe("VALIDATION_FAILED")
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
    })

    it("returns 409 when order is already COMPLETED", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("COMPLETED") as any)

        const res = await POST(makeRequest({ content: "Account: a@b / 123" }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/Illegal order transition/i)
        expect(prismaMock.orderFulfillment.create).not.toHaveBeenCalled()
    })

    it("returns 409 when order is CLOSED", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("CLOSED") as any)

        const res = await POST(makeRequest({ content: "Account: a@b / 123" }), makeCtx())

        expect(res.status).toBe(409)
        expect(prismaMock.orderFulfillment.create).not.toHaveBeenCalled()
    })

    it("returns 409 when order is still PENDING (MANUAL must pass AWAITING first)", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("PENDING") as any)

        const res = await POST(makeRequest({ content: "Account: a@b / 123" }), makeCtx())

        expect(res.status).toBe(409)
        expect(prismaMock.orderFulfillment.create).not.toHaveBeenCalled()
    })

    it("transitions PROCESSING -> COMPLETED, creates OrderFulfillment, runs commissions, fires email", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("PROCESSING") as any)
        setupTxMock()
        ;(prismaMock.orderFulfillment.create as jest.Mock).mockResolvedValueOnce({ id: "ff_1" })
        ;(prismaMock.order.update as jest.Mock).mockResolvedValueOnce({})

        const res = await POST(makeRequest({ content: "Account: a@b / 123" }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toEqual({ ok: true })
        expect(prismaMock.orderFulfillment.create).toHaveBeenCalledWith({
            data: { orderId: ORDER_ID, content: "Account: a@b / 123", fulfilledBy: ADMIN_ID },
        })
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: ORDER_ID },
            data: { status: "COMPLETED" },
        })
        expect(createCommissionsMock).toHaveBeenCalledTimes(1)
        expect(createCommissionsMock.mock.calls[0][1]).toMatchObject({
            orderId: ORDER_ID,
            distributorId: DISTRIBUTOR_ID,
            orderEmail: "buyer@test.com",
            orderAmount: 9900,
        })
        expect(checkMilestoneMock).toHaveBeenCalledTimes(1)
        expect(checkMilestoneMock.mock.calls[0][1]).toBe(DISTRIBUTOR_ID)
        expect(sendEmailMock).toHaveBeenCalledWith(ORDER_ID)
    })

    it("transitions AWAITING_FULFILLMENT -> COMPLETED (skip-PROCESSING quick path)", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("AWAITING_FULFILLMENT") as any)
        setupTxMock()
        ;(prismaMock.orderFulfillment.create as jest.Mock).mockResolvedValueOnce({ id: "ff_2" })
        ;(prismaMock.order.update as jest.Mock).mockResolvedValueOnce({})

        const res = await POST(makeRequest({ content: "Acct creds" }), makeCtx())

        expect(res.status).toBe(200)
        expect(prismaMock.orderFulfillment.create).toHaveBeenCalled()
    })

    it("does NOT call commission helpers when order has no distributor", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(
            makeManualOrder("PROCESSING", { distributorId: null }) as any,
        )
        setupTxMock()
        ;(prismaMock.orderFulfillment.create as jest.Mock).mockResolvedValueOnce({ id: "ff_3" })
        ;(prismaMock.order.update as jest.Mock).mockResolvedValueOnce({})

        const res = await POST(makeRequest({ content: "Acct creds" }), makeCtx())

        expect(res.status).toBe(200)
        expect(createCommissionsMock).not.toHaveBeenCalled()
        expect(checkMilestoneMock).not.toHaveBeenCalled()
        expect(sendEmailMock).toHaveBeenCalledWith(ORDER_ID)
    })

    it("returns 409 (not 500) when OrderFulfillment.orderId unique constraint hit (idempotency)", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("PROCESSING") as any)
        ;(prismaMock.$transaction as unknown as jest.Mock).mockImplementation(async () => {
            const err: any = new Error("Unique constraint failed")
            err.code = "P2002"
            throw err
        })

        const res = await POST(makeRequest({ content: "creds" }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/已被发货/)
        expect(sendEmailMock).not.toHaveBeenCalled()
    })

    it("returns 400 invalidJsonBody when request body is not valid JSON", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })

        const res = await POST(makeRequest(undefined, { invalidJson: true }), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(400)
        expect(body.error).toMatch(/Invalid JSON/i)
    })

    it("returns 404 when order not found", async () => {
        adminSessionMock.mockResolvedValue({ user: { id: ADMIN_ID, email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(null)

        const res = await POST(makeRequest({ content: "creds" }), makeCtx())

        expect(res.status).toBe(404)
    })
})
