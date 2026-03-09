import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return {
        __esModule: true,
        prisma: prismaMock,
    }
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

jest.mock("@/lib/config", () => {
    const mock = {
        turnstileSecretKey: undefined as string | undefined,
        nodeEnv: "test" as string,
        siteUrl: "http://localhost:3000",
    }
    ;(global as { __configMock?: typeof mock }).__configMock = mock
    return { config: mock, getConfig: () => mock }
})

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

function createJsonRequest(body: unknown, cookies?: { get: (name: string) => { value: string } | undefined }): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

function createInvalidJsonRequest(): NextRequest {
    return {
        json: async () => {
            throw new Error("Invalid JSON")
        },
    } as unknown as NextRequest
}

describe("POST /api/orders (create order)", () => {
    function getConfigMock() {
        return (global as {
            __configMock?: { turnstileSecretKey?: string; nodeEnv?: string; siteUrl?: string }
        }).__configMock!
    }

    beforeEach(() => {
        jest.clearAllMocks()
        getConfigMock().turnstileSecretKey = undefined
        ;(prismaMock.$transaction as jest.Mock).mockReset()
    })

    it("returns 400 when body is not valid JSON", async () => {
        const res = await POST(createInvalidJsonRequest())
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data).toEqual({ error: "Invalid JSON body" })
    })

    it("returns 400 when validation fails (missing productId)", async () => {
        const res = await POST(
            createJsonRequest({
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
        expect(data.details).toBeDefined()
    })

    it("returns 400 when validation fails (invalid email)", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "not-an-email",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 400 when validation fails (password too short)", async () => {
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "short",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 404 when product does not exist", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(null)

        const res = await POST(
            createJsonRequest({
                productId: "nonexistent",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found or unavailable" })
    })

    it("returns 404 when product is INACTIVE", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 5,
            status: "INACTIVE",
        })

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found or unavailable" })
    })

    it("returns 400 when quantity exceeds maxQuantity", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 2,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(10)

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 5,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toContain("Quantity must be between 1 and 2")
    })

    it("returns 400 when quantity is less than 1", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 5,
            status: "ACTIVE",
        })

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 0,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 400 when order amount is invalid (zero)", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 0,
            maxQuantity: 10,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(10)

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Invalid order amount")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns 400 when order amount exceeds max (999999.99)", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 500000,
            maxQuantity: 10,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(10)

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 2,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toBe("Invalid order amount")
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns 400 when insufficient stock", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 10,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(1)

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 3,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(400)
        expect(data.error).toContain("Insufficient stock")
        expect(data.error).toContain("Available: 1")
    })

    it("creates order and reserves cards, returns orderNo and amount", async () => {
        const product = {
            id: "prod_1",
            name: "Test Product",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(3)

        const createdOrder = {
            id: "order_new",
            orderNo: "550e8400-e29b-41d4-a716-446655440000",
            productId: "prod_1",
            email: "user@example.com",
            passwordHash: "hashed-password",
            quantity: 2,
            amount: 100,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        const mockTx = {
            order: {
                create: jest.fn().mockResolvedValue(createdOrder),
            },
            card: {
                findMany: jest.fn().mockResolvedValue([
                    { id: "card_1" },
                    { id: "card_2" },
                ]),
                updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx)
        )

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "User@Example.com",
                orderPassword: "password123",
                quantity: 2,
            })
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            orderNo: createdOrder.orderNo,
            amount: 100,
            paymentUrl: null,
        })
        expect(data.successToken).toBeUndefined()
        expect(mockTx.order.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                orderNo: expect.any(String),
                productId: "prod_1",
                productNameSnapshot: "Test Product",
                email: "user@example.com",
                passwordHash: "hashed-password",
                quantity: 2,
                amount: 100,
                status: "PENDING",
                clientIp: "127.0.0.1",
            }),
        })
        expect(mockTx.card.findMany).toHaveBeenCalledWith({
            where: { productId: "prod_1", status: "UNSOLD" },
            take: 2,
            orderBy: { createdAt: "asc" },
            select: { id: true },
        })
        expect(mockTx.card.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["card_1", "card_2"] } },
            data: { status: "RESERVED", orderId: "order_new" },
        })
    })

    it("ignores client-submitted price and amount; order amount is computed from product.price only", async () => {
        const product = {
            id: "prod_1",
            name: "Test Product",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(3)
        const createdOrder = {
            id: "order_new",
            orderNo: "550e8400-e29b-41d4-a716-446655440000",
            productId: "prod_1",
            email: "user@example.com",
            passwordHash: "hashed-password",
            quantity: 2,
            amount: 100,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        const mockTx = {
            order: { create: jest.fn().mockResolvedValue(createdOrder) },
            card: {
                findMany: jest.fn().mockResolvedValue([{ id: "card_1" }, { id: "card_2" }]),
                updateMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx)
        )

        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 2,
                price: 0.01,
                amount: 0.01,
            })
        )

        expect(res.status).toBe(200)
        const createCall = (mockTx.order.create as jest.Mock).mock.calls[0][0]
        expect(createCall.data.amount).toBe(100)
        expect(createCall.data).not.toMatchObject({ price: 0.01, amount: 0.01 })
    })

    it("in development completes order immediately and returns successToken and paymentUrl null", async () => {
        const { completePendingOrder } = require("@/lib/complete-pending-order")
        ;(completePendingOrder as jest.Mock).mockResolvedValueOnce({
            done: true,
            orderNo: "uuid-dev-mock",
        })
        getConfigMock().nodeEnv = "development"
        getConfigMock().siteUrl = "https://example.com"
        const product = {
            id: "prod_1",
            name: "Test Product",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(3)
        const createdOrder = {
            id: "order_new",
            orderNo: "uuid-dev-mock",
            productId: "prod_1",
            email: "user@example.com",
            passwordHash: "hashed-password",
            quantity: 1,
            amount: 50,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        const mockTx = {
            order: {
                create: jest.fn().mockResolvedValue(createdOrder),
            },
            card: {
                findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx)
        )
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data.paymentUrl).toBeNull()
        expect(data.successToken).toBeDefined()
        expect(typeof data.successToken).toBe("string")
        expect(data.orderNo).toBe("uuid-dev-mock")
        expect(data.amount).toBe(50)
        expect(completePendingOrder).toHaveBeenCalledWith("uuid-dev-mock")
        getConfigMock().nodeEnv = "test"
    })

    it("in development returns 500 when completePendingOrder returns done false", async () => {
        const { completePendingOrder } = require("@/lib/complete-pending-order")
        ;(completePendingOrder as jest.Mock).mockResolvedValueOnce({
            done: false,
            error: "Order not found",
        })
        getConfigMock().nodeEnv = "development"
        const product = {
            id: "prod_1",
            name: "Test Product",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(3)
        const createdOrder = {
            id: "order_new",
            orderNo: "uuid-dev-mock",
            productId: "prod_1",
            email: "user@example.com",
            passwordHash: "hashed-password",
            quantity: 1,
            amount: 50,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        const mockTx = {
            order: { create: jest.fn().mockResolvedValue(createdOrder) },
            card: {
                findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx)
        )
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(500)
        expect(data.error).toBeDefined()
        getConfigMock().nodeEnv = "test"
    })

    it("throws when reservation finds insufficient cards during transaction", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 5,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(2)
        const mockTx = {
            order: {
                create: jest.fn().mockResolvedValue({
                    id: "order_new",
                    orderNo: "uuid-1",
                    productId: "prod_1",
                    email: "user@example.com",
                    passwordHash: "hash",
                    quantity: 2,
                    amount: 200,
                    status: "PENDING",
                    paidAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }),
            },
            card: {
                findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
        }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
            cb(mockTx)
        )
        await expect(
            POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                })
            )
        ).rejects.toThrow("Insufficient stock during reservation")
    })

    it("returns 500 when order creation hits P2002 unique constraint exhausts retries", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 5,
            status: "ACTIVE",
        })
        prismaMock.card.count.mockResolvedValueOnce(10)
        const p2002 = new Error("Unique constraint") as Error & { code?: string; meta?: { target?: string[] } }
        p2002.code = "P2002"
        p2002.meta = { target: ["orderNo"] }
        ;(prismaMock.$transaction as jest.Mock).mockImplementation(() => Promise.reject(p2002))
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            })
        )
        const data = await res.json()
        expect(res.status).toBe(500)
        expect(data.error).toMatch(/retries|try again/)
    })

    it("returns 429 when rate limited", async () => {
        const { checkOrderCreateRateLimit } = require("@/lib/rate-limit")
        ;(checkOrderCreateRateLimit as jest.Mock).mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: "Too many orders. Please try again later." }),
                { status: 429, headers: { "Content-Type": "application/json" } },
            ),
        )
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            }),
        )
        expect(res.status).toBe(429)
        const data = await res.json()
        expect(data.error).toContain("Too many")
        expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
    })

    it("returns 400 when IP has too many PENDING orders", async () => {
        prismaMock.order.count.mockResolvedValueOnce(3)
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
            price: 100,
            maxQuantity: 5,
            status: "ACTIVE",
        })
        const res = await POST(
            createJsonRequest({
                productId: "prod_1",
                email: "user@example.com",
                orderPassword: "password123",
                quantity: 1,
            }),
        )
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/unpaid order|expire/)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    describe("Turnstile verification", () => {
        it("returns 400 when Turnstile is configured but token is missing", async () => {
            getConfigMock().turnstileSecretKey = "test-secret"
            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 1,
                })
            )
            const data = await res.json()
            expect(res.status).toBe(400)
            expect(data.error).toContain("安全验证")
            const { verifyTurnstileToken } = require("@/lib/turnstile")
            expect(verifyTurnstileToken).not.toHaveBeenCalled()
        })

        it("returns 400 when Turnstile is configured but token is empty string", async () => {
            getConfigMock().turnstileSecretKey = "test-secret"
            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 1,
                    turnstileToken: "   ",
                })
            )
            const data = await res.json()
            expect(res.status).toBe(400)
            expect(data.error).toContain("安全验证")
        })

        it("returns 400 when Turnstile verification fails", async () => {
            getConfigMock().turnstileSecretKey = "test-secret"
            const { verifyTurnstileToken } = require("@/lib/turnstile")
            ;(verifyTurnstileToken as jest.Mock).mockResolvedValueOnce({
                success: false,
                "error-codes": ["invalid-input-response"],
            })
            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 1,
                    turnstileToken: "bad-token",
                })
            )
            const data = await res.json()
            expect(res.status).toBe(400)
            expect(data.error).toMatch(/安全验证|重试/)
            expect(verifyTurnstileToken).toHaveBeenCalledWith(
                "bad-token",
                "test-secret",
                "127.0.0.1"
            )
            expect(prismaMock.$transaction).not.toHaveBeenCalled()
        })

        it("returns 400 when Turnstile verification returns timeout-or-duplicate", async () => {
            getConfigMock().turnstileSecretKey = "test-secret"
            const { verifyTurnstileToken } = require("@/lib/turnstile")
            ;(verifyTurnstileToken as jest.Mock).mockResolvedValueOnce({
                success: false,
                "error-codes": ["timeout-or-duplicate"],
            })
            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 1,
                    turnstileToken: "expired-token",
                })
            )
            const data = await res.json()
            expect(res.status).toBe(400)
            expect(data.error).toMatch(/过期|刷新/)
        })

        it("creates order when Turnstile is configured and token verification succeeds", async () => {
            getConfigMock().turnstileSecretKey = "test-secret"
            const { verifyTurnstileToken } = require("@/lib/turnstile")
            ;(verifyTurnstileToken as jest.Mock).mockResolvedValueOnce({
                success: true,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce({
                id: "prod_1",
                name: "Test",
                price: 50,
                maxQuantity: 5,
                status: "ACTIVE",
            })
            prismaMock.card.count.mockResolvedValueOnce(3)
            prismaMock.order.count.mockResolvedValueOnce(0)
            const createdOrder = {
                id: "order_new",
                orderNo: "550e8400-e29b-41d4-a716-446655440000",
                productId: "prod_1",
                email: "user@example.com",
                passwordHash: "hashed-password",
                quantity: 1,
                amount: 50,
                status: "PENDING",
                paidAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            }
            const mockTx = {
                order: {
                    create: jest.fn().mockResolvedValue(createdOrder),
                },
                card: {
                    findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
                    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
                cb(mockTx)
            )

            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 1,
                    turnstileToken: "valid-token",
                })
            )
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.orderNo).toBe(createdOrder.orderNo)
            expect(verifyTurnstileToken).toHaveBeenCalledWith(
                "valid-token",
                "test-secret",
                "127.0.0.1"
            )
            expect(mockTx.order.create).toHaveBeenCalled()
        })
    })

    describe("promoCode attribution (distributor)", () => {
        const product = {
            id: "prod_1",
            name: "Test Product",
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
        }
        const createdOrder = {
            id: "order_new",
            orderNo: "550e8400-e29b-41d4-a716-446655440000",
            productId: "prod_1",
            email: "user@example.com",
            passwordHash: "hashed-password",
            quantity: 2,
            amount: 100,
            status: "PENDING",
            paidAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        function mockTxWithCreate() {
            const tx = {
                order: { create: jest.fn().mockResolvedValue(createdOrder) },
                card: {
                    findMany: jest.fn().mockResolvedValue([{ id: "card_1" }, { id: "card_2" }]),
                    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
                },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation((cb: (t: unknown) => Promise<unknown>) =>
                cb(tx)
            )
            return tx
        }

        it("includes distributorId when body has valid promoCode", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({ id: "dist_1" })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    distributorId: "dist_1",
                    productId: "prod_1",
                    quantity: 2,
                    amount: 100,
                }),
            })
        })

        it("includes distributorId when cookie has valid promoCode and body has none", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({ id: "dist_1" })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()
            const cookies = {
                get: (name: string) =>
                    name === "distributor_promo_code" ? { value: "PROMO1" } : undefined,
            }

            const res = await POST(
                createJsonRequest(
                    {
                        productId: "prod_1",
                        email: "user@example.com",
                        orderPassword: "password123",
                        quantity: 2,
                    },
                    cookies
                )
            )

            expect(res.status).toBe(200)
            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    distributorId: "dist_1",
                }),
            })
        })

        it("does not set distributorId when promoCode is invalid or distributor disabled", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(null)
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "INVALID",
                })
            )

            expect(res.status).toBe(200)
            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data).not.toHaveProperty("distributorId")
        })

        it("prefers body promoCode over cookie when both present", async () => {
            prismaMock.user.findFirst
                .mockResolvedValueOnce({ id: "dist_body" })
                .mockResolvedValueOnce({ id: "dist_cookie" })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()
            const cookies = {
                get: (name: string) =>
                    name === "distributor_promo_code" ? { value: "COOKIE_PROMO" } : undefined,
            }

            await POST(
                createJsonRequest(
                    {
                        productId: "prod_1",
                        email: "user@example.com",
                        orderPassword: "password123",
                        quantity: 2,
                        promoCode: "BODY_PROMO",
                    },
                    cookies
                )
            )

            expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
                where: { distributorCode: "BODY_PROMO", role: "DISTRIBUTOR", disabledAt: null },
                select: { id: true, discountCodeEnabled: true, discountPercent: true },
            })
            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    distributorId: "dist_body",
                }),
            })
        })

        it("applies discount and sets discountPercentApplied when distributor has discountCodeEnabled and discountPercent", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: 5,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            const res = await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )

            expect(res.status).toBe(200)
            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    distributorId: "dist_1",
                    amount: 95,
                    discountPercentApplied: 5,
                }),
            })
        })

        it("no discount when distributor has discountCodeEnabled false", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: false,
                discountPercent: 5,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(100)
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })

        it("no discount when distributor has discountCodeEnabled true but discountPercent null", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: null,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(100)
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })

        it("no discount when distributor has discountPercent 0", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: 0,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(100)
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })

        it("no discount when distributor has discountPercent greater than 100", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: 101,
            })
            prismaMock.product.findUnique.mockResolvedValueOnce(product)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockTxWithCreate()

            await POST(
                createJsonRequest({
                    productId: "prod_1",
                    email: "user@example.com",
                    orderPassword: "password123",
                    quantity: 2,
                    promoCode: "PROMO1",
                })
            )

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(100)
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })
    })
})
