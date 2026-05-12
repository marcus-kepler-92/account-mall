/**
 * GET /api/orders/[orderId]/payment-status
 * Covers: rate-limit ordering, token validation, order status responses, Cache-Control header.
 */
import { NextRequest } from "next/server"
import { GET } from "@/app/api/orders/[orderId]/payment-status/route"
import { prismaMock } from "../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-success-token", () => ({
    __esModule: true,
    verifyOrderSuccessToken: jest.fn().mockReturnValue(true),
}))

jest.mock("@/lib/rate-limit", () => ({
    checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { checkOrderQueryRateLimit } from "@/lib/rate-limit"

const verifyTokenMock = verifyOrderSuccessToken as jest.Mock
const rateLimitMock = checkOrderQueryRateLimit as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(orderNo: string, token: string): NextRequest {
    const url = `http://localhost/api/orders/${orderNo}/payment-status?token=${encodeURIComponent(token)}`
    return new NextRequest(url)
}

function makeContext(orderNo: string) {
    return { params: Promise.resolve({ orderId: orderNo }) }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/orders/[orderId]/payment-status", () => {
    beforeEach(() => {
        verifyTokenMock.mockReset().mockReturnValue(true)
        rateLimitMock.mockReset().mockResolvedValue(null)
        prismaMock.order.findUnique.mockReset()
    })

    it("returns 429 and skips token check when rate limited", async () => {
        const limited = new Response(JSON.stringify({ error: "Too many requests." }), { status: 429 })
        rateLimitMock.mockResolvedValue(limited)

        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))

        expect(res.status).toBe(429)
        expect(verifyTokenMock).not.toHaveBeenCalled()
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
    })

    it("returns 401 when token is missing", async () => {
        verifyTokenMock.mockReturnValue(false)
        const url = "http://localhost/api/orders/order-1/payment-status"
        const req = new NextRequest(url)
        const res = await GET(req, makeContext("order-1"))
        expect(res.status).toBe(401)
        const body = await res.json()
        expect(body).toEqual({ error: "invalid_token" })
    })

    it("returns 401 when token fails verification", async () => {
        verifyTokenMock.mockReturnValue(false)
        const res = await GET(makeRequest("order-1", "bad-token"), makeContext("order-1"))
        expect(res.status).toBe(401)
        expect(await res.json()).toEqual({ error: "invalid_token" })
    })

    it("returns 401 when token is expired (verifyOrderSuccessToken returns false)", async () => {
        verifyTokenMock.mockReturnValue(false)
        const res = await GET(makeRequest("order-1", "expired-token"), makeContext("order-1"))
        expect(res.status).toBe(401)
    })

    it("returns 404 when order not found", async () => {
        prismaMock.order.findUnique.mockResolvedValue(null)
        const res = await GET(makeRequest("ghost-order", "valid-tok"), makeContext("ghost-order"))
        expect(res.status).toBe(404)
        expect(await res.json()).toEqual({ error: "not_found" })
    })

    it("returns 200 with status PENDING", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING" } as any)
        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "PENDING" })
    })

    it("returns 200 with status COMPLETED", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "COMPLETED" } as any)
        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "COMPLETED" })
    })

    it("returns 200 with status CLOSED", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "CLOSED" } as any)
        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ status: "CLOSED" })
    })

    it("sets Cache-Control: no-store on successful response", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING" } as any)
        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))
        expect(res.headers.get("Cache-Control")).toBe("no-store")
    })

    it("sets Cache-Control: no-store on 401 response", async () => {
        verifyTokenMock.mockReturnValue(false)
        const res = await GET(makeRequest("order-1", "bad"), makeContext("order-1"))
        expect(res.status).toBe(401)
        expect(res.headers.get("Cache-Control")).toBe("no-store")
    })

    it("sets Cache-Control: no-store on 404 response", async () => {
        prismaMock.order.findUnique.mockResolvedValue(null)
        const res = await GET(makeRequest("order-1", "tok"), makeContext("order-1"))
        expect(res.status).toBe(404)
        expect(res.headers.get("Cache-Control")).toBe("no-store")
    })

    it("passes orderNo from route params to verifyOrderSuccessToken", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "PENDING" } as any)
        await GET(makeRequest("ORD-XYZ", "my-token"), makeContext("ORD-XYZ"))
        expect(verifyTokenMock).toHaveBeenCalledWith("ORD-XYZ", "my-token")
    })

    it("queries DB only with orderNo (select status only)", async () => {
        prismaMock.order.findUnique.mockResolvedValue({ status: "COMPLETED" } as any)
        await GET(makeRequest("order-42", "tok"), makeContext("order-42"))
        expect(prismaMock.order.findUnique).toHaveBeenCalledWith({
            where: { orderNo: "order-42" },
            select: { status: true },
        })
    })
})
