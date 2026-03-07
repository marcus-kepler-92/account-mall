/**
 * Security attack test cases for order-related APIs.
 * Black-box: send malicious or abusive input, assert safe response (no leak, no 500, proper rejection).
 */

import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/orders/route"
import { GET as GETOrder, PATCH, DELETE } from "@/app/api/orders/[orderId]/route"
import { POST as POSTLookup } from "@/app/api/orders/lookup/route"
import { POST as POSTLookupByEmail } from "@/app/api/orders/lookup-by-email/route"
import { POST as POSTGetPaymentUrl } from "@/app/api/orders/get-payment-url/route"
import { POST as POSTByEmail } from "@/app/api/orders/by-email/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})
jest.mock("@/lib/auth-guard", () => ({ __esModule: true, getAdminSession: jest.fn() }))
jest.mock("better-auth/crypto", () => ({
    __esModule: true,
    hashPassword: jest.fn().mockResolvedValue("hash"),
    verifyPassword: jest.fn(),
}))
jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
    checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
    getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
    MAX_PENDING_ORDERS_PER_IP: 3,
}))
jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue(null),
}))
jest.mock("@/lib/config", () => ({
    config: {
        pendingOrderTimeoutMs: 15 * 60 * 1000,
        nodeEnv: "development",
        turnstileSecretKey: undefined as string | undefined,
        siteUrl: "http://localhost:3000",
    },
    getConfig: () => ({
        pendingOrderTimeoutMs: 15 * 60 * 1000,
        nodeEnv: "development",
        turnstileSecretKey: undefined,
        siteUrl: "http://localhost:3000",
    }),
}))
jest.mock("@/lib/get-payment-url", () => ({
    getPaymentUrlForOrder: jest.fn().mockReturnValue("https://pay.example/pay"),
}))
jest.mock("@/lib/alipay", () => ({
    getAlipayPagePayUrl: jest.fn().mockReturnValue(null),
}))
jest.mock("@/lib/yipay", () => ({
    isYipayConfigured: jest.fn().mockReturnValue(false),
    getYipayPagePayUrl: jest.fn().mockReturnValue(null),
}))
jest.mock("@/lib/turnstile", () => ({
    verifyTurnstileToken: jest.fn(),
}))
jest.mock("@/lib/complete-pending-order", () => ({
    completePendingOrder: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const verifyPassword = require("better-auth/crypto").verifyPassword as jest.Mock

function createUrlRequest(url: string): NextRequest {
    return { url } as unknown as NextRequest
}
function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

describe("Security: AuthZ / IDOR (admin and order access)", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        getAdminSession.mockResolvedValue(null)
    })

    it("GET /api/orders (admin list) returns 401 without session", async () => {
        const res = await GET(createUrlRequest("http://localhost/api/orders"))
        const data = await res.json()
        expect(res.status).toBe(401)
        expect(data.error).toBe("Unauthorized")
        expect(prismaMock.order.findMany).not.toHaveBeenCalled()
    })

    it("GET /api/orders/:id returns 401 without session", async () => {
        const ctx = { params: Promise.resolve({ orderId: "any-id" }) }
        const res = await GETOrder({} as NextRequest, ctx as any)
        const data = await res.json()
        expect(res.status).toBe(401)
        expect(data.error).toBe("Unauthorized")
    })

    it("PATCH /api/orders/:id returns 401 without session", async () => {
        const ctx = { params: Promise.resolve({ orderId: "any-id" }) }
        const res = await PATCH(createJsonRequest({ status: "COMPLETED" }), ctx as any)
        const data = await res.json()
        expect(res.status).toBe(401)
        expect(data.error).toBe("Unauthorized")
    })

    it("DELETE /api/orders/:id returns 401 without session", async () => {
        const ctx = { params: Promise.resolve({ orderId: "any-id" }) }
        const res = await DELETE({} as NextRequest, ctx as any)
        const data = await res.json()
        expect(res.status).toBe(401)
        expect(data.error).toBe("Unauthorized")
    })

    it("lookup by orderNo+password returns same fuzzy message for wrong password (no user enumeration)", async () => {
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        prismaMock.order.findUnique.mockResolvedValue({
            id: "o1",
            orderNo: "ORD-REAL",
            passwordHash: "hash",
            status: "PENDING",
            product: { name: "P" },
            cards: [],
            createdAt: new Date(),
            amount: 99,
        })
        verifyPassword.mockResolvedValue(false)

        const res = await POSTLookup(
            createJsonRequest({ orderNo: "ORD-REAL", password: "wrong666" }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/not found|password incorrect|订单不存在|密码/)
        expect(data).not.toHaveProperty("orderNo")
        expect(data).not.toHaveProperty("cards")
    })

    it("lookup by orderNo returns same fuzzy message when order does not exist (no enumeration)", async () => {
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        prismaMock.order.findUnique.mockResolvedValue(null)

        const res = await POSTLookup(
            createJsonRequest({ orderNo: "NONEXISTENT", password: "secret123" }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/not found|password incorrect|订单不存在|密码/)
    })

    it("lookup-by-email returns same fuzzy message for no orders vs wrong password (no email enumeration)", async () => {
        prismaMock.order.findMany.mockResolvedValue([])
        const resEmpty = await POSTLookupByEmail(
            createJsonRequest({ email: "nonexistent@test.com", password: "secret123" }),
        )
        const dataEmpty = await resEmpty.json()
        expect(resEmpty.status).toBe(400)
        expect(dataEmpty.error).toMatch(/not found|password incorrect|Order not found/)

        prismaMock.order.findMany.mockResolvedValue([
            { id: "o1", orderNo: "O1", passwordHash: "h", status: "PENDING", product: { name: "P" }, cards: [], createdAt: new Date(), quantity: 1, amount: 99 },
        ])
        verifyPassword.mockResolvedValue(false)
        const resWrong = await POSTLookupByEmail(
            createJsonRequest({ email: "real@test.com", password: "wrong666" }),
        )
        const dataWrong = await resWrong.json()
        expect(resWrong.status).toBe(400)
        expect(dataWrong.error).toMatch(/not found|password incorrect|Order not found/)
        expect(dataEmpty.error).toBe(dataWrong.error)
    })
})

describe("Security: Injection and malicious input", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getAdminSession.mockResolvedValue(null)
    })

    it("lookup with SQL-like orderNo returns 400 or 404, never 500", async () => {
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        prismaMock.order.findUnique.mockResolvedValue(null)

        const res = await POSTLookup(
            createJsonRequest({
                orderNo: "' OR '1'='1' --",
                password: "secret123",
            }),
        )
        expect([400, 404]).toContain(res.status)
        const data = await res.json()
        expect(data).toHaveProperty("error")
        expect(data.error).not.toMatch(/sql|syntax|query|prisma/i)
    })

    it("lookup with XSS-like orderNo is rejected or sanitized (no script in response)", async () => {
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        prismaMock.order.findUnique.mockResolvedValue(null)

        const res = await POSTLookup(
            createJsonRequest({
                orderNo: "<script>alert(1)</script>",
                password: "secret123",
            }),
        )
        const data = await res.json()
        const bodyStr = JSON.stringify(data)
        expect(bodyStr).not.toContain("<script>")
        expect(bodyStr).not.toContain("alert(1)")
    })

    it("create order rejects invalid email or CRLF (no header injection)", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod-1",
                email: "user@example.com\r\nX-Injected: evil",
                orderPassword: "password123",
                quantity: 1,
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Validation|validation|email|Invalid/i)
    })

    it("create order rejects quantity type confusion (string instead of number)", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod-1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: "1",
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Validation|validation/i)
    })

    it("create order rejects negative quantity", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod-1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: -1,
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Validation|validation|Quantity/i)
    })

    it("create order rejects zero quantity", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod-1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 0,
            }),
        )
        await res.json()
        expect(res.status).toBe(400)
    })

    it("create order rejects oversized quantity (integer overflow style)", async () => {
        prismaMock.product.findUnique.mockResolvedValue({
            id: "p1",
            name: "P",
            price: 10,
            maxQuantity: 5,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValue(10)

        const res = await POST(
            createJsonRequest({
                productId: "p1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 999999,
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Quantity|between|1 and 5/)
    })

    it("get-payment-url with invalid orderNo does not leak internal error", async () => {
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        prismaMock.order.findUnique.mockResolvedValue(null)

        const res = await POSTGetPaymentUrl(
            createJsonRequest({ orderNo: "'; DROP TABLE orders;--", password: "secret123" }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/订单不存在|密码|not found|password/i)
        expect(data.error).not.toMatch(/prisma|sql|syntax|error code/i)
    })
})

describe("Security: Mass assignment and privilege", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("PATCH order requires admin session", async () => {
        getAdminSession.mockResolvedValue(null)
        const ctx = { params: Promise.resolve({ orderId: "o1" }) }
        const res = await PATCH(createJsonRequest({ status: "CLOSED" }), ctx as any)
        expect(res.status).toBe(401)
    })

    it("PATCH order does not accept arbitrary status from client without validation", async () => {
        getAdminSession.mockResolvedValue({ id: "admin_1" })
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
            fn(prismaMock),
        )
        const fullOrder = {
            id: "o1",
            orderNo: "ORD-1",
            email: "u@test.com",
            quantity: 1,
            amount: 99,
            status: "COMPLETED",
            paidAt: new Date(),
            createdAt: new Date(),
            product: { id: "p1", name: "P", price: 10 },
            cards: [{ id: "c1", status: "SOLD" }],
        }
        prismaMock.order.findUnique.mockResolvedValueOnce({
            id: "o1",
            status: "PENDING",
            cards: [{ id: "c1", status: "RESERVED" }],
        }).mockResolvedValueOnce(fullOrder)

        const res = await PATCH(
            createJsonRequest({ status: "COMPLETED", paidAt: "2020-01-01", note: "<script>" }),
            { params: Promise.resolve({ orderId: "o1" }) } as any,
        )
        const data = await res.json()
        expect([200, 400]).toContain(res.status)
        if (res.status === 200) {
            expect(data.note).not.toBe("<script>")
        }
    })

    it("create order with extra body field status does not set order status", async () => {
        const { completePendingOrder } = require("@/lib/complete-pending-order")
        ;(completePendingOrder as jest.Mock).mockResolvedValue({
            done: true,
            orderNo: "uuid-1",
        })
        getAdminSession.mockResolvedValue(null)
        prismaMock.product.findUnique.mockResolvedValue({
            id: "p1",
            name: "P",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValue(3)
        const created = {
            id: "ord-new",
            orderNo: "uuid-1",
            productId: "p1",
            email: "user@example.com",
            passwordHash: "hash",
            quantity: 1,
            amount: 50,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        const mockTx = {
            order: { create: jest.fn().mockResolvedValue(created) },
            card: {
                findMany: jest.fn().mockResolvedValue([{ id: "c1" }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx),
        )

        const res = await POST(
            createJsonRequest({
                productId: "p1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                status: "COMPLETED",
                paidAt: new Date().toISOString(),
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data.orderNo).toBeDefined()
        const createCall = (mockTx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.status).toBe("PENDING")
        expect(createCall.data.paidAt).toBeUndefined()
    })
})

describe("Security: Rate limit and abuse", () => {
    it("order create returns 429 when rate limit is exceeded", async () => {
        const { checkOrderCreateRateLimit } = require("@/lib/rate-limit")
        ;(checkOrderCreateRateLimit as jest.Mock).mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: "Too many orders. Please try again later." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
            ),
        )
        const res = await POST(
            createJsonRequest({
                productId: "p1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            }),
        )
        expect(res.status).toBe(429)
        const data = await res.json()
        expect(data.error).toMatch(/Too many|try again/i)
        expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
    })

    it("lookup returns 429 when query rate limit exceeded", async () => {
        const { checkOrderQueryRateLimit } = require("@/lib/rate-limit")
        ;(checkOrderQueryRateLimit as jest.Mock).mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: "Too many requests. Please try again later." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
            ),
        )
        const res = await POSTLookup(
            createJsonRequest({ orderNo: "ORD-1", password: "secret123" }),
        )
        expect(res.status).toBe(429)
        const data = await res.json()
        expect(data.error).toMatch(/Too many|try again/i)
    })
})

describe("Security: Input length and format", () => {
    it("create order rejects too-short password", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "p1",
                email: "user@example.com",
                orderPassword: "12345",
                quantity: 1,
            }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Validation|validation|Password|6/)
    })

    it("lookup rejects too-short password", async () => {
        const res = await POSTLookup(
            createJsonRequest({ orderNo: "ORD-1", password: "12345" }),
        )
        await res.json()
        expect(res.status).toBe(400)
    })

    it("by-email rejects invalid email format", async () => {
        const res = await POSTByEmail(
            createJsonRequest({ email: "not-an-email", password: "secret123" }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toMatch(/Validation|validation|email/i)
    })
})

describe("Security: Path and parameter abuse", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("GET /api/orders with invalid query (e.g. page=-1) returns 400 when admin", async () => {
        getAdminSession.mockResolvedValue({ id: "admin_1" })
        const res = await GET(createUrlRequest("http://localhost/api/orders?page=-1"))
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error ?? data).toBeDefined()
    })

    it("GET /api/orders/:id with path-traversal-like orderId returns 404 not 500", async () => {
        getAdminSession.mockResolvedValue({ id: "admin_1" })
        prismaMock.order.findUnique.mockResolvedValue(null)
        const ctx = { params: Promise.resolve({ orderId: "../../../etc/passwd" }) }
        const res = await GETOrder({} as NextRequest, ctx as any)
        const data = await res.json()
        expect(res.status).toBe(404)
        expect(data.error).toMatch(/not found|Order not found/i)
    })

    it("lookup with empty orderNo returns 400", async () => {
        const res = await POSTLookup(
            createJsonRequest({ orderNo: "", password: "secret123" }),
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBeDefined()
    })
})
