/**
 * 收费 AUTO_FETCH 下单流程专项测试
 */
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

jest.mock("@/lib/get-payment-url", () => ({
    getPaymentUrlForOrder: jest.fn().mockReturnValue("https://pay.example.com/pay"),
}))

jest.mock("@/lib/config", () => {
    const mock = {
        turnstileSecretKey: undefined as string | undefined,
        nodeEnv: "test" as string,
        siteUrl: "http://localhost:3000",
        autoFetchMaxQuantityPerOrder: 1,
        autoFetchCooldownHours: 1,
        autoFetchSourceUrl: "https://example.com/share/accounts",
        pendingOrderTimeoutMs: 900_000,
        exitDiscountSecret: undefined as string | undefined,
    }
    ;(global as { __configMockAutoFetch?: typeof mock }).__configMockAutoFetch = mock
    return { config: mock, getConfig: () => mock }
})

jest.mock("@/lib/turnstile", () => ({
    verifyTurnstileToken: jest.fn(),
}))

jest.mock("@/lib/complete-pending-order", () => ({
    completePendingOrder: jest.fn(),
}))

jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-success-token"),
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    scrapeSharedAccounts: jest.fn(),
}))

import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"
import { getAlipayPagePayUrl } from "@/lib/alipay"
import { completePendingOrder } from "@/lib/complete-pending-order"

const scrapeSharedAccountsMock = scrapeSharedAccounts as jest.Mock
const getAlipayPagePayUrlMock = getAlipayPagePayUrl as jest.Mock
const completePendingOrderMock = completePendingOrder as jest.Mock

function getConfigMock() {
    return (global as {
        __configMockAutoFetch?: {
            turnstileSecretKey?: string
            nodeEnv?: string
            autoFetchSourceUrl?: string
            autoFetchCooldownHours?: number
        }
    }).__configMockAutoFetch!
}

const SCRAPED_ACCOUNT = {
    account: "test@apple.com",
    password: "Abc123!",
    region: "US",
    status: "valid",
}

function makePaidAutoFetchProduct(overrides?: Record<string, unknown>) {
    return {
        id: "prod_auto",
        name: "Test Auto Account",
        price: 19.9,
        maxQuantity: 1,
        status: "ACTIVE",
        productType: "AUTO_FETCH",
        sourceUrl: "https://example.com/share/accounts",
        ...overrides,
    }
}

function createJsonRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
        cookies: { get: () => undefined },
    } as unknown as NextRequest
}

const ORDER_BODY = {
    productId: "prod_auto",
    email: "buyer@example.com",
    orderPassword: "password123",
    quantity: 1,
}

describe("POST /api/orders — paid AUTO_FETCH product", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getConfigMock().nodeEnv = "test"
        getConfigMock().autoFetchSourceUrl = "https://example.com/share/accounts"
        prismaMock.order.count.mockResolvedValue(0)
        prismaMock.user.findFirst.mockResolvedValue(null)

        // Default: scrape returns one account
        scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT])
    })

    describe("爬取成功 + price>0 → 收费流程", () => {
        it("创建 PENDING 订单 + RESERVED 卡 + 返回 paymentUrl", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockResolvedValue({
                            id: "ord_1",
                            orderNo: "order-uuid-1",
                        }),
                    },
                    card: {
                        create: jest.fn().mockResolvedValue({ id: "card_1" }),
                    },
                }
                await fn(tx)
                return { orderNo: "order-uuid-1", orderId: "ord_1", tx }
            })

            const res = await POST(createJsonRequest(ORDER_BODY))
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.orderNo).toBeDefined()
            expect(data.paymentUrl).toBeDefined()
            expect(data.paymentUrl).not.toBeNull()
            // 不应立即完成（无 claimedAccount）
            expect(data.claimedAccount).toBeUndefined()
        })

        it("PENDING 订单 amount 正确（含折扣计算）", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct({ price: 19.9 }))
            // 分销商有 10% 折扣
            prismaMock.user.findFirst.mockResolvedValue({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: 10,
            })

            let capturedAmount: number | undefined
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockImplementation(async (args: any) => {
                            capturedAmount = Number(args.data.amount)
                            return { id: "ord_1", orderNo: "order-uuid-1" }
                        }),
                    },
                    card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
                }
                await fn(tx)
                return { orderNo: "order-uuid-1", orderId: "ord_1", tx }
            })

            await POST(createJsonRequest({ ...ORDER_BODY, promoCode: "PROMO10" }))
            // 19.9 * 0.9 = 17.91
            expect(capturedAmount).toBeCloseTo(17.91, 1)
        })

        it("卡密状态应为 RESERVED", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())
            let capturedCardStatus: string | undefined
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockResolvedValue({ id: "ord_1", orderNo: "order-uuid-1" }),
                    },
                    card: {
                        create: jest.fn().mockImplementation(async (args: any) => {
                            capturedCardStatus = args.data.status
                            return { id: "card_1" }
                        }),
                    },
                }
                await fn(tx)
                return { orderNo: "order-uuid-1", orderId: "ord_1", tx }
            })

            await POST(createJsonRequest(ORDER_BODY))
            expect(capturedCardStatus).toBe("RESERVED")
        })
    })

    describe("爬取成功 + price=0 → 免费流程（回归）", () => {
        it("直接创建 COMPLETED 订单 + 返回 successToken", async () => {
            prismaMock.product.findUnique.mockResolvedValue(
                makePaidAutoFetchProduct({ price: 0 })
            )
            getConfigMock().nodeEnv = "development" // 跳过冷却检查

            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockResolvedValue({ id: "ord_1", orderNo: "order-uuid-1" }),
                    },
                    card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
                }
                await fn(tx)
                return { orderNo: "order-uuid-1" }
            })

            const res = await POST(createJsonRequest(ORDER_BODY))
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.successToken).toBeDefined()
            expect(data.claimedAccount).toBeDefined()
            expect(data.claimedAccount.account).toBe("test@apple.com")
        })
    })

    describe("爬取失败", () => {
        it("爬取返回空列表 → 返回 400 '暂无可领取账号'", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())
            scrapeSharedAccountsMock.mockResolvedValue([])

            const res = await POST(createJsonRequest(ORDER_BODY))
            const data = await res.json()

            expect(res.status).toBe(400)
            expect(data.error).toContain("暂无可领取账号")
        })

        it("product.sourceUrl 为空且无全局配置 → 返回 400", async () => {
            prismaMock.product.findUnique.mockResolvedValue(
                makePaidAutoFetchProduct({ sourceUrl: null })
            )
            getConfigMock().autoFetchSourceUrl = ""

            const res = await POST(createJsonRequest(ORDER_BODY))
            const data = await res.json()

            expect(res.status).toBe(400)
            expect(data.error).toContain("该商品暂时无法领取")
        })
    })

    describe("数量固定为 1", () => {
        it("忽略客户端提交的 quantity > 1", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())

            const res = await POST(createJsonRequest({ ...ORDER_BODY, quantity: 5 }))
            const data = await res.json()

            // quantity=5 超过 autoFetchMaxQuantityPerOrder=1，应返回 400
            expect(res.status).toBe(400)
            expect(data.error).toContain("Quantity must be between 1 and 1")
        })
    })

    describe("development 环境快捷通道", () => {
        it("dev 环境下收费 AUTO_FETCH 调用 completePendingOrder", async () => {
            getConfigMock().nodeEnv = "development"
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct({ price: 19.9 }))
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockResolvedValue({ id: "ord_1", orderNo: "order-uuid-1" }),
                    },
                    card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
                }
                await fn(tx)
                return { orderNo: "order-uuid-1", orderId: "ord_1", tx }
            })
            completePendingOrderMock.mockResolvedValue({ done: true, orderNo: "order-uuid-1" })

            const res = await POST(createJsonRequest(ORDER_BODY))
            const data = await res.json()

            expect(completePendingOrderMock).toHaveBeenCalled()
            expect(res.status).toBe(200)
            expect(data.successToken).toBeDefined()
        })
    })

    describe("fingerprintHash 写入收费 AUTO_FETCH 订单", () => {
        it("有指纹 → fingerprintHash 存入 PENDING 订单 data", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())

            let capturedOrderData: Record<string, unknown> | undefined
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
                            capturedOrderData = args.data
                            return { id: "ord_1", orderNo: "uuid-paid" }
                        }),
                    },
                    card: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
                }
                await fn(tx)
                return { orderNo: "uuid-paid", orderId: "ord_1" }
            })

            await POST(createJsonRequest({ ...ORDER_BODY, fingerprintHash: "fp-paid-123" }))

            expect(capturedOrderData?.fingerprintHash).toBe("fp-paid-123")
        })

        it("无指纹 → fingerprintHash 不出现在 PENDING 订单 data", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makePaidAutoFetchProduct())

            let capturedOrderData: Record<string, unknown> | undefined
            prismaMock.$transaction.mockImplementation(async (fn: Function) => {
                const tx = {
                    order: {
                        create: jest.fn().mockImplementation(async (args: { data: Record<string, unknown> }) => {
                            capturedOrderData = args.data
                            return { id: "ord_1", orderNo: "uuid-paid" }
                        }),
                    },
                    card: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
                }
                await fn(tx)
                return { orderNo: "uuid-paid", orderId: "ord_1" }
            })

            await POST(createJsonRequest(ORDER_BODY))

            expect(capturedOrderData?.fingerprintHash).toBeUndefined()
        })
    })
})
