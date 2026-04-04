/**
 * 推广码（affiliate code, cookie-based）vs 优惠码（coupon code, body-based）语义区分测试
 *
 * - 推广码：仅归因，不受 couponEnabled 限制，不给折扣
 * - 优惠码：归因 + 折扣，受 couponEnabled 限制
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../__mocks__/prisma"
import { Prisma } from "@prisma/client"

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
    checkTurnstileFallbackRateLimit: jest.fn().mockResolvedValue(true),
    getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
    MAX_PENDING_ORDERS_PER_IP: 3,
}))

jest.mock("@/lib/get-payment-url", () => ({
    getPaymentUrlForOrder: jest.fn().mockReturnValue(null),
}))

jest.mock("@/lib/config", () => {
    const mock = {
        turnstileSecretKey: undefined as string | undefined,
        nodeEnv: "test" as string,
        siteUrl: "http://localhost:3000",
        basePromoDiscountPercent: 5,
        autoFetchMaxQuantityPerOrder: 1,
        autoFetchCooldownHours: 1,
        autoFetchSourceUrls: ["https://example.com/accounts"],
        pendingOrderTimeoutMs: 900_000,
        exitDiscountSecret: undefined as string | undefined,
    }
    ;(global as { __configMockAffiliateCode?: typeof mock }).__configMockAffiliateCode = mock
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
    scrapeMultipleUrls: jest.fn(),
}))

jest.mock("@/lib/exit-discount", () => ({
    verifyExitDiscountToken: jest.fn(),
}))

import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"

const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock

function withAffiliateCookie(code: string) {
    return {
        get: (name: string) =>
            name === "distributor_promo_code" ? { value: code } : undefined,
    }
}

function createRequest(
    body: unknown,
    cookies?: { get: (name: string) => { value: string } | undefined },
): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

const BASE_NORMAL_PRODUCT = {
    id: "prod_1",
    name: "Test Product",
    slug: "test-product",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("50"),
    maxQuantity: 5,
    status: "ACTIVE",
    productType: "NORMAL",
    sourceUrl: null,
    validityHours: null,
    allowAccountSwitch: true,
    accountSwitchLimit: 1,
    couponEnabled: true,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
}

const BASE_FREE_AUTO_FETCH_PRODUCT = {
    ...BASE_NORMAL_PRODUCT,
    id: "prod_free",
    name: "Free Account",
    price: new Prisma.Decimal("0"),
    productType: "AUTO_FETCH",
    sourceUrl: "https://example.com/accounts",
    couponEnabled: false,
}

const CREATED_ORDER = {
    id: "order_new",
    orderNo: "550e8400-e29b-41d4-a716-446655440000",
    productId: "prod_1",
    distributorId: null,
    email: "user@example.com",
    passwordHash: "hashed-password",
    quantity: 1,
    amount: new Prisma.Decimal("50"),
    discountPercentApplied: null,
    productNameSnapshot: "Test Product",
    status: "PENDING",
    paidAt: null,
    expiresAt: null,
    promoCode: null,
    paymentMethod: "alipay",
    clientIp: null,
    fingerprintHash: null,
    exitDiscountMeta: null,
    switchAccountCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
}

function mockNormalTx() {
    const tx = {
        order: { create: jest.fn().mockResolvedValue(CREATED_ORDER) },
        card: {
            findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
    }
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    )
    return tx
}

const ORDER_BODY = {
    productId: "prod_1",
    email: "user@example.com",
    orderPassword: "password123",
    quantity: 1,
}

const SCRAPED_ACCOUNT = {
    account: "test@apple.com",
    password: "Abc123!",
    region: "US",
    status: "valid",
}

describe("推广码（cookie）vs 优惠码（body）语义区分", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(global as { __configMockAffiliateCode?: { nodeEnv?: string } }).__configMockAffiliateCode!.nodeEnv = "test"
    })

    describe("正常商品 + couponEnabled=false", () => {
        const product = { ...BASE_NORMAL_PRODUCT, couponEnabled: false }

        it("推广码（cookie）不被 couponEnabled=false 拦截，下单成功", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
            prismaMock.card.count.mockResolvedValueOnce(3)
            mockNormalTx()

            const res = await POST(
                createRequest(ORDER_BODY, withAffiliateCookie("AFFILIATE1")),
            )

            expect(res.status).toBe(200)
        })

        it("推广码（cookie）归因有效：distributorId 写入订单", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockNormalTx()

            await POST(createRequest(ORDER_BODY, withAffiliateCookie("AFFILIATE1")))

            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ distributorId: "dist_1" }),
            })
        })

        it("推广码（cookie）不给折扣，即使 distributor.discountCodeEnabled=true", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce({ ...product, couponEnabled: true } as any)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockNormalTx()

            await POST(createRequest(ORDER_BODY, withAffiliateCookie("AFFILIATE1")))

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            // 推广码路径：原价，无折扣
            expect(call.data.amount).toBe(50)
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })

        it("优惠码（body）在 couponEnabled=false 时返回 400", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce(product as any)

            const res = await POST(
                createRequest({ ...ORDER_BODY, promoCode: "COUPON1" }),
            )

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toMatch(/该商品不支持使用优惠码/)
        })
    })

    describe("正常商品 + couponEnabled=true：优惠码给折扣，推广码不给", () => {
        const product = { ...BASE_NORMAL_PRODUCT, couponEnabled: true }

        it("优惠码（body）给折扣", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockNormalTx()

            await POST(createRequest({ ...ORDER_BODY, promoCode: "COUPON1" }))

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(45) // 50 * (1 - 10/100)
            expect(call.data.discountPercentApplied).toBe(10)
        })

        it("推广码（cookie）不给折扣", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
            prismaMock.card.count.mockResolvedValueOnce(3)
            const tx = mockNormalTx()

            await POST(createRequest(ORDER_BODY, withAffiliateCookie("AFFILIATE1")))

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBe(50) // 原价
            expect(call.data).not.toHaveProperty("discountPercentApplied")
        })
    })

    describe("免费 AUTO_FETCH 商品 + couponEnabled=false（报告的 bug 场景）", () => {
        it("推广码（cookie）不被拦截，免费领取成功", async () => {
            // 执行顺序：user.findFirst（分销商查询）→ order.count（IP限制）→ product.findUnique
            // → createAutoFetchOrder: order.findFirst（活跃订单检查）→ scrape → blacklist → tx
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.product.findUnique.mockResolvedValueOnce(BASE_FREE_AUTO_FETCH_PRODUCT as any)
            prismaMock.order.findFirst.mockResolvedValueOnce(null) // no active order
            scrapeMultipleUrlsMock.mockResolvedValueOnce([SCRAPED_ACCOUNT])
            prismaMock.accountBlacklist.findMany.mockResolvedValueOnce([])

            const freeOrder = {
                id: "order_free",
                orderNo: "free-order-uuid",
                productId: "prod_free",
                email: "user@example.com",
                amount: new Prisma.Decimal("0"),
                status: "COMPLETED",
            }
            const tx = {
                order: { create: jest.fn().mockResolvedValue(freeOrder) },
                card: { create: jest.fn().mockResolvedValue({}) },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation(
                (cb: (t: unknown) => Promise<unknown>) => cb(tx),
            )

            const res = await POST(
                createRequest(
                    {
                        productId: "prod_free",
                        email: "user@example.com",
                        orderPassword: "password123",
                        quantity: 1,
                    },
                    withAffiliateCookie("AFFILIATE1"),
                ),
            )

            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.orderNo).toBe("free-order-uuid")
        })
    })

    describe("无效推广码（cookie）静默降级", () => {
        it("推广码（cookie）失效（分销商不存在）→ 下单成功，无分销归因", async () => {
            // 分销商不存在 → user.findFirst 返回 null
            prismaMock.user.findFirst.mockResolvedValueOnce(null)
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.product.findUnique.mockResolvedValueOnce(BASE_FREE_AUTO_FETCH_PRODUCT as any)
            prismaMock.order.findFirst.mockResolvedValueOnce(null) // no active order
            scrapeMultipleUrlsMock.mockResolvedValueOnce([SCRAPED_ACCOUNT])
            prismaMock.accountBlacklist.findMany.mockResolvedValueOnce([])

            const freeOrder = {
                id: "order_free",
                orderNo: "free-order-uuid",
                productId: "prod_free",
                email: "user@example.com",
                amount: new Prisma.Decimal("0"),
                status: "COMPLETED",
            }
            const tx = {
                order: { create: jest.fn().mockResolvedValue(freeOrder) },
                card: { create: jest.fn().mockResolvedValue({}) },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation(
                (cb: (t: unknown) => Promise<unknown>) => cb(tx),
            )

            const res = await POST(
                createRequest(
                    { productId: "prod_free", email: "user@example.com", orderPassword: "pass123", quantity: 1 },
                    withAffiliateCookie("EXPIRED_CODE"),
                ),
            )

            expect(res.status).toBe(200)
            // distributorId 不应写入订单
            const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(createCall.data).not.toHaveProperty("distributorId")
        })

        it("推广码（cookie）失效但 body 有优惠码 → 优惠码无效错误正常返回（400）", async () => {
            // lookupCode = couponCode（优先），分销商不存在 → 报错
            prismaMock.user.findFirst.mockResolvedValueOnce(null)

            const res = await POST(
                createRequest(
                    { productId: "prod_1", email: "user@example.com", orderPassword: "pass123", quantity: 1, promoCode: "INVALID_COUPON" },
                    withAffiliateCookie("EXPIRED_CODE"),
                ),
            )

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toMatch(/优惠码无效/)
        })

        it("推广码（cookie）有效 → 归因写入订单，但不给折扣", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce({
                id: "dist_1",
                discountCodeEnabled: true,
                discountPercent: new Prisma.Decimal("10"),
            } as any)
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.product.findUnique.mockResolvedValueOnce(BASE_FREE_AUTO_FETCH_PRODUCT as any)
            prismaMock.order.findFirst.mockResolvedValueOnce(null)
            scrapeMultipleUrlsMock.mockResolvedValueOnce([SCRAPED_ACCOUNT])
            prismaMock.accountBlacklist.findMany.mockResolvedValueOnce([])

            const freeOrder = {
                id: "order_free",
                orderNo: "free-order-uuid",
                productId: "prod_free",
                email: "user@example.com",
                amount: new Prisma.Decimal("0"),
                status: "COMPLETED",
            }
            const tx = {
                order: { create: jest.fn().mockResolvedValue(freeOrder) },
                card: { create: jest.fn().mockResolvedValue({}) },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation(
                (cb: (t: unknown) => Promise<unknown>) => cb(tx),
            )

            const res = await POST(
                createRequest(
                    { productId: "prod_free", email: "user@example.com", orderPassword: "pass123", quantity: 1 },
                    withAffiliateCookie("VALID_AFFILIATE"),
                ),
            )

            expect(res.status).toBe(200)
            const createCall = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(createCall.data.distributorId).toBe("dist_1") // 有归因
            expect(createCall.data.amount).toBe(0)               // 免费，无折扣逻辑影响
        })
    })
})
