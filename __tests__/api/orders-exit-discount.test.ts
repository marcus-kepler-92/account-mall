import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("better-auth/crypto", () => ({
    __esModule: true,
    hashPassword: jest.fn().mockResolvedValue("hashed-password"),
}))

jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
    getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
    MAX_PENDING_ORDERS_PER_IP: 3,
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

jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-success-token"),
}))

// verifyExitDiscountToken can be mocked to control results
jest.mock("@/lib/exit-discount", () => ({
    __esModule: true,
    verifyExitDiscountToken: jest.fn(),
    generateExitDiscountToken: jest.fn(),
}))

jest.mock("@/lib/config", () => {
    const mock = {
        turnstileSecretKey: undefined as string | undefined,
        nodeEnv: "test" as string,
        siteUrl: "http://localhost:3000",
        exitDiscountSecret: "test-exit-secret" as string | undefined,
        exitDiscountPercent: 5,
        exitDiscountTtlMs: 900_000,
    }
    ;(global as { __ordersExitDiscountConfigMock?: typeof mock }).__ordersExitDiscountConfigMock = mock
    return { config: mock, getConfig: () => mock }
})

function getConfigMock() {
    return (global as { __ordersExitDiscountConfigMock?: {
        turnstileSecretKey?: string
        nodeEnv?: string
        exitDiscountSecret?: string
    } }).__ordersExitDiscountConfigMock!
}

function createJsonRequest(body: unknown, cookies?: { get: (name: string) => { value: string } | undefined }): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

/** Build a standard mock transaction that creates an order and reserves cards */
function mockTransaction(createdOrder: Record<string, unknown>) {
    const mockTx = {
        order: { create: jest.fn().mockResolvedValue(createdOrder) },
        card: {
            findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    }
    ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb(mockTx))
    return mockTx
}

const product = {
    id: "prod_1",
    name: "Test Product",
    price: 100,
    maxQuantity: 5,
    status: "ACTIVE",
}

const baseCreatedOrder = {
    id: "order_new",
    orderNo: "550e8400-e29b-41d4-a716-446655440000",
    productId: "prod_1",
    email: "user@example.com",
    passwordHash: "hashed-password",
    quantity: 1,
    amount: 95,
    status: "PENDING",
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
}

describe("POST /api/orders -- exit discount token handling", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getConfigMock().turnstileSecretKey = undefined
        getConfigMock().nodeEnv = "test"
        getConfigMock().exitDiscountSecret = "test-exit-secret"
        ;(prismaMock.$transaction as jest.Mock).mockReset()
    })

    it("applies 5% discount and stores exitDiscountMeta when valid token provided without promoCode", async () => {
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")
        ;(verifyExitDiscountToken as jest.Mock).mockReturnValueOnce({
            valid: true,
            payload: {
                productId: "prod_1",
                visitorId: "visitor-1",
                fingerprintHash: "fp-hash-1",
                ip: "127.0.0.1",
                discountPercent: 5,
                exp: Date.now() + 900_000,
            },
        })

        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction(baseCreatedOrder)

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                exitDiscountToken: "valid.token.here",
            })
        )

        expect(res.status).toBe(200)
        // 金额应为 100 * 0.95 = 95
        expect(tx.order.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                amount: 95,
                discountPercentApplied: 5,
                exitDiscountMeta: expect.stringContaining("visitor-1"),
            }),
        })
    })

    it("stores complete signal data in exitDiscountMeta JSON", async () => {
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")
        ;(verifyExitDiscountToken as jest.Mock).mockReturnValueOnce({
            valid: true,
            payload: {
                productId: "prod_1",
                visitorId: "visitor-abc",
                fingerprintHash: "fp-xyz",
                ip: "10.0.0.1",
                discountPercent: 5,
                exp: Date.now() + 900_000,
            },
        })

        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction(baseCreatedOrder)

        await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                exitDiscountToken: "valid.token.here",
            })
        )

        const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
        const meta = JSON.parse(createCall.data.exitDiscountMeta)
        expect(meta.visitorId).toBe("visitor-abc")
        expect(meta.fingerprintHash).toBe("fp-xyz")
        expect(meta.ip).toBe("10.0.0.1")
        expect(meta.discountPercent).toBe(5)
    })

    it("ignores exitDiscountToken and applies promoCode discount when both present", async () => {
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")
        // verifyExitDiscountToken should NOT be called when promoCode is present
        ;(verifyExitDiscountToken as jest.Mock).mockReturnValue({ valid: true, payload: { discountPercent: 5 } })

        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "dist_1",
            discountCodeEnabled: true,
            discountPercent: 10,
        })
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction({ ...baseCreatedOrder, amount: 90 })

        await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                promoCode: "DIST10",
                exitDiscountToken: "valid.token.here",
            })
        )

        // verifyExitDiscountToken should NOT have been called since promoCode takes precedence
        expect(verifyExitDiscountToken).not.toHaveBeenCalled()
        // Amount should be distributor discount: 100 * 0.9 = 90
        const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.amount).toBe(90)
        expect(createCall.data.discountPercentApplied).toBe(10)
        expect(createCall.data).not.toHaveProperty("exitDiscountMeta")
    })

    it("applies full price when exitDiscountSecret is not configured", async () => {
        getConfigMock().exitDiscountSecret = undefined
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")

        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction({ ...baseCreatedOrder, amount: 100 })

        await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                exitDiscountToken: "valid.token.here",
            })
        )

        expect(verifyExitDiscountToken).not.toHaveBeenCalled()
        const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.amount).toBe(100)
        expect(createCall.data).not.toHaveProperty("exitDiscountMeta")
    })

    it("applies full price when token verification fails (valid: false)", async () => {
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")
        ;(verifyExitDiscountToken as jest.Mock).mockReturnValueOnce({ valid: false, reason: "invalid" })

        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction({ ...baseCreatedOrder, amount: 100 })

        await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                exitDiscountToken: "tampered.token",
            })
        )

        const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.amount).toBe(100)
        expect(createCall.data).not.toHaveProperty("exitDiscountMeta")
    })

    it("applies full price when token productId does not match request productId", async () => {
        const { verifyExitDiscountToken } = require("@/lib/exit-discount")
        ;(verifyExitDiscountToken as jest.Mock).mockReturnValueOnce({
            valid: true,
            payload: {
                productId: "different_product",  // Mismatched!
                visitorId: "visitor-1",
                fingerprintHash: "fp-hash-1",
                ip: "127.0.0.1",
                discountPercent: 5,
                exp: Date.now() + 900_000,
            },
        })

        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTransaction({ ...baseCreatedOrder, amount: 100 })

        await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
                exitDiscountToken: "mismatched.product.token",
            })
        )

        const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.amount).toBe(100)
        expect(createCall.data).not.toHaveProperty("exitDiscountMeta")
    })
})
