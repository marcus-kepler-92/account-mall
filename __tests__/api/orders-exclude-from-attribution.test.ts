/**
 * Integration tests: commissionMode=NONE on POST /api/orders.
 *
 * When a product has commissionMode=NONE (supersedes the old excludeFromAttribution=true):
 * - Orders are never linked to a distributor (distributorId = null)
 * - Cookie-based affiliate attribution is suppressed
 * - Manual coupon code attribution is suppressed
 * - Distributor discount (discountPercent) is still applied when using a valid coupon code
 * - Invalid coupon codes still return 400 (validation unchanged)
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
    hashPassword: jest.fn().mockResolvedValue("hashed-pw"),
}))

jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
    checkTurnstileFallbackRateLimit: jest.fn().mockResolvedValue(true),
    getClientIp: jest.fn().mockReturnValue("1.2.3.4"),
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
        basePromoDiscountPercent: 5,
        autoFetchMaxQuantityPerOrder: 1,
        autoFetchCooldownHours: 24,
        autoFetchSourceUrls: ["https://source.example.com"],
        exitDiscountSecret: undefined as string | undefined,
        blacklistExpiryHours: 24,
    }
    ;(global as { __configMockExcludeAttr?: typeof mock }).__configMockExcludeAttr = mock
    return { config: mock, getConfig: () => mock }
})

jest.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: jest.fn() }))
jest.mock("@/lib/turnstile-policy", () => ({
    isStorefrontTurnstileEnforced: jest.fn().mockReturnValue(false),
}))
jest.mock("@/lib/complete-pending-order", () => ({ completePendingOrder: jest.fn() }))
jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-token"),
}))
jest.mock("@/lib/scrape-shared-accounts", () => ({
    scrapeMultipleUrls: jest.fn(),
}))
jest.mock("@/lib/exit-discount", () => ({
    verifyExitDiscountToken: jest.fn().mockReturnValue({ valid: false }),
}))
jest.mock("@/lib/purchase-limit", () => ({
    checkPurchaseLimit: jest.fn().mockResolvedValue({ blocked: false }),
}))

import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"

const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock

function makeNormalProduct(overrides?: Record<string, unknown>) {
    return {
        id: "prod_1",
        name: "Test Product",
        slug: "test-product",
        summary: null,
        description: null,
        image: null,
        price: new Prisma.Decimal("50"),
        maxQuantity: 10,
        status: "ACTIVE",
        productType: "NORMAL",
        sourceUrl: null,
        validityHours: null,
        allowAccountSwitch: false,
        accountSwitchLimit: 1,
        couponEnabled: true,
        riskWarningEnabled: false,
        riskWarningTitle: null,
        riskWarningContent: null,
        riskWarningCountdown: null,
        riskWarningConfirmText: null,
        purchaseLimitEnabled: false,
        purchaseLimitQuantity: 1,
        commissionMode: "GLOBAL",
        commissionValue: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as any
}

function makeAutoFetchProduct(overrides?: Record<string, unknown>) {
    return {
        id: "prod_af",
        name: "AutoFetch Product",
        slug: "autofetch-product",
        summary: null,
        description: null,
        image: null,
        price: new Prisma.Decimal("0"),
        maxQuantity: 1,
        status: "ACTIVE",
        productType: "AUTO_FETCH",
        sourceUrl: "https://source.example.com",
        validityHours: 24,
        allowAccountSwitch: true,
        accountSwitchLimit: 1,
        couponEnabled: false,
        riskWarningEnabled: false,
        riskWarningTitle: null,
        riskWarningContent: null,
        riskWarningCountdown: null,
        riskWarningConfirmText: null,
        purchaseLimitEnabled: false,
        purchaseLimitQuantity: 1,
        commissionMode: "GLOBAL",
        commissionValue: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as any
}

function makeRequest(
    body: unknown,
    cookies?: { get: (name: string) => { value: string } | undefined },
): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

function withAffiliateCookie(code: string) {
    return { get: (name: string) => name === "distributor_promo_code" ? { value: code } : undefined }
}

function makeDistributor(overrides?: Record<string, unknown>) {
    return {
        id: "dist_1",
        discountCodeEnabled: true,
        discountPercent: new Prisma.Decimal("10"),
        ...overrides,
    } as any
}

const BASE_BODY = {
    productId: "prod_1",
    email: "buyer@example.com",
    orderPassword: "password123",
    quantity: 1,
    paymentMethod: "alipay",
}

const CREATED_ORDER = {
    id: "order_new",
    orderNo: "550e8400-e29b-41d4-a716-446655440000",
    amount: new Prisma.Decimal("50"),
    status: "PENDING",
}

function mockNormalTx() {
    const tx = {
        order: { create: jest.fn().mockResolvedValue(CREATED_ORDER) },
        card: {
            findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        exitDiscountUsage: { create: jest.fn() },
    }
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    )
    return tx
}

describe("POST /api/orders — commissionMode NONE", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(global as { __configMockExcludeAttr?: Record<string, unknown> }).__configMockExcludeAttr!.nodeEnv = "test"
        prismaMock.order.count.mockResolvedValue(0)
    })

    describe("commissionMode = GLOBAL（默认）：归因正常生效", () => {
        it("cookie 归因写入 distributorId", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(makeDistributor())
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "GLOBAL" }),
            )
            prismaMock.card.count.mockResolvedValueOnce(5)
            const tx = mockNormalTx()

            await POST(makeRequest(BASE_BODY, withAffiliateCookie("CODE1")))

            expect(tx.order.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ distributorId: "dist_1" }),
            })
        })

        it("优惠码归因写入 distributorId + 折扣生效", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(makeDistributor())
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "GLOBAL" }),
            )
            prismaMock.card.count.mockResolvedValueOnce(5)
            const tx = mockNormalTx()

            await POST(makeRequest({ ...BASE_BODY, promoCode: "CODE1" }))

            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data.distributorId).toBe("dist_1")
            expect(call.data.amount).toBe(45) // 50 * 0.9
            expect(call.data.discountPercentApplied).toBe(10)
        })
    })

    describe("commissionMode = NONE：无论何种码，归因均被阻断", () => {
        it("cookie 归因被阻断：distributorId 不写入订单", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(makeDistributor())
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "NONE" }),
            )
            prismaMock.card.count.mockResolvedValueOnce(5)
            const tx = mockNormalTx()

            const res = await POST(makeRequest(BASE_BODY, withAffiliateCookie("CODE1")))

            expect(res.status).toBe(200)
            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data).not.toHaveProperty("distributorId")
        })

        it("优惠码归因被阻断：distributorId 不写入，但折扣仍然生效", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(makeDistributor())
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "NONE" }),
            )
            prismaMock.card.count.mockResolvedValueOnce(5)
            const tx = mockNormalTx()

            const res = await POST(makeRequest({ ...BASE_BODY, promoCode: "CODE1" }))

            expect(res.status).toBe(200)
            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data).not.toHaveProperty("distributorId")
            // discount is preserved per product owner's decision
            expect(call.data.amount).toBe(45)
            expect(call.data.discountPercentApplied).toBe(10)
        })

        it("无码下单：本就无归因，正常创建订单", async () => {
            prismaMock.user.findFirst.mockResolvedValue(null)
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "NONE" }),
            )
            prismaMock.card.count.mockResolvedValueOnce(5)
            const tx = mockNormalTx()

            const res = await POST(makeRequest(BASE_BODY))

            expect(res.status).toBe(200)
            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data).not.toHaveProperty("distributorId")
        })

        it("无效优惠码仍返回 400（校验逻辑不受影响）", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(null) // distributor not found
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeNormalProduct({ commissionMode: "NONE" }),
            )

            const res = await POST(makeRequest({ ...BASE_BODY, promoCode: "INVALID" }))

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toMatch(/优惠码无效/)
        })
    })

    describe("AUTO_FETCH 商品 + commissionMode NONE", () => {
        const SCRAPED = { account: "acc@apple.com", password: "Pass1!", region: "US", status: "valid" }

        function mockAutoFetchTx() {
            const freeOrder = { id: "order_af", orderNo: "af-order-uuid", amount: new Prisma.Decimal("0"), status: "COMPLETED" }
            const tx = {
                order: { create: jest.fn().mockResolvedValue(freeOrder) },
                card: { create: jest.fn().mockResolvedValue({}) },
            }
            ;(prismaMock.$transaction as jest.Mock).mockImplementation(
                (cb: (t: unknown) => Promise<unknown>) => cb(tx),
            )
            return tx
        }

        it("cookie 归因被阻断：FREE AUTO_FETCH 订单无 distributorId", async () => {
            prismaMock.user.findFirst.mockResolvedValueOnce(makeDistributor())
            prismaMock.order.count.mockResolvedValueOnce(0) // IP pending count check
            prismaMock.product.findUnique.mockResolvedValueOnce(
                makeAutoFetchProduct({ commissionMode: "NONE" }),
            )
            scrapeMultipleUrlsMock.mockResolvedValueOnce([SCRAPED])
            prismaMock.accountBlacklist.findMany.mockResolvedValueOnce([])
            const tx = mockAutoFetchTx()

            const res = await POST(
                makeRequest(
                    { productId: "prod_af", email: "buyer@example.com", orderPassword: "pass123", quantity: 1, paymentMethod: "alipay" },
                    withAffiliateCookie("CODE1"),
                ),
            )

            expect(res.status).toBe(200)
            const call = (tx.order.create as jest.Mock).mock.calls[0][0]
            expect(call.data).not.toHaveProperty("distributorId")
        })
    })
})
