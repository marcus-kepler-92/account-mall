import { NextRequest } from "next/server"
import { prismaMock } from "../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
    verifyPassword: jest.fn(),
}))

jest.mock("@/lib/zpay", () => ({
    queryZpayOrder: jest.fn(),
}))

jest.mock("@/lib/complete-pending-order", () => ({
    completePendingOrder: jest.fn(),
}))

jest.mock("@/lib/rate-limit", () => ({
    checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

import { POST } from "@/app/api/orders/check-payment/route"
import { verifyPassword } from "better-auth/crypto"
import { queryZpayOrder } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"

const verifyPasswordMock = verifyPassword as jest.Mock
const queryZpayMock = queryZpayOrder as jest.Mock
const completeMock = completePendingOrder as jest.Mock
const rateLimitMock = checkOrderQueryRateLimit as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/orders/check-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    })
}

const VALID_BODY = { orderNo: "order-xyz", password: "secret123" }

const PENDING_ORDER = {
    status: "PENDING",
    passwordHash: "hashed",
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/orders/check-payment", () => {
    beforeEach(() => {
        verifyPasswordMock.mockReset()
        queryZpayMock.mockReset()
        completeMock.mockReset()
        rateLimitMock.mockResolvedValue(null)
        prismaMock.order.findUnique.mockResolvedValue(null)
    })

    it("returns 429 when rate-limited", async () => {
        rateLimitMock.mockResolvedValue(new Response(null, { status: 429 }))
        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(429)
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
    })

    it("returns 400 when order not found", async () => {
        prismaMock.order.findUnique.mockResolvedValue(null)
        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(400)
    })

    it("returns 400 when password is wrong", async () => {
        prismaMock.order.findUnique.mockResolvedValue(PENDING_ORDER)
        verifyPasswordMock.mockResolvedValue(false)
        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(400)
        expect(queryZpayMock).not.toHaveBeenCalled()
    })

    it("returns current status directly for COMPLETED orders without querying Zpay", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ ...PENDING_ORDER, status: "COMPLETED" })
        verifyPasswordMock.mockResolvedValue(true)
        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "COMPLETED" })
        expect(queryZpayMock).not.toHaveBeenCalled()
    })

    it("returns current status directly for CLOSED orders without querying Zpay", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ ...PENDING_ORDER, status: "CLOSED" })
        verifyPasswordMock.mockResolvedValue(true)
        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "CLOSED" })
        expect(queryZpayMock).not.toHaveBeenCalled()
    })

    it("calls completePendingOrder and returns COMPLETED when Zpay confirms paid", async () => {
        prismaMock.order.findUnique.mockResolvedValue(PENDING_ORDER)
        verifyPasswordMock.mockResolvedValue(true)
        queryZpayMock.mockResolvedValue({ paid: true })
        completeMock.mockResolvedValue({ done: true })

        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "COMPLETED" })
        expect(completeMock).toHaveBeenCalledWith("order-xyz")
    })

    it("returns PENDING when Zpay says not paid", async () => {
        prismaMock.order.findUnique.mockResolvedValue(PENDING_ORDER)
        verifyPasswordMock.mockResolvedValue(true)
        queryZpayMock.mockResolvedValue({ paid: false })

        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "PENDING" })
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("returns PENDING when queryZpayOrder returns null (unconfigured)", async () => {
        prismaMock.order.findUnique.mockResolvedValue(PENDING_ORDER)
        verifyPasswordMock.mockResolvedValue(true)
        queryZpayMock.mockResolvedValue(null)

        const res = await POST(makeRequest(VALID_BODY))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "PENDING" })
    })
})
