/**
 * Security + correctness tests for cross-sell discount in POST /api/orders
 * under the cs-token (sourceOrderId-bound) model.
 *
 * Covers:
 *  - Happy path: valid cs token + email match + resolveCrossSellDiscounts → discount applied
 *  - Forged / tampered token → full price
 *  - Wrong email (source order belongs to different buyer) → full price
 *  - Source order not found → full price
 *  - resolveCrossSellDiscounts returns empty map (any reason) → full price
 *  - Email comparison is case-insensitive
 *  - Stacking: cross-sell + promoCode / exit discount → only cross-sell applied
 *  - CrossSellUsage written on happy path
 */

import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../__mocks__/prisma"
import { Prisma } from "@prisma/client"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})
jest.mock("@/lib/auth-guard", () => ({ __esModule: true, getAdminSession: jest.fn() }))
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
jest.mock("@/lib/turnstile", () => ({
    verifyTurnstileToken: jest.fn(),
}))
jest.mock("@/lib/complete-pending-order", () => ({
    completePendingOrder: jest.fn(),
}))
jest.mock("@/lib/order-success-token", () => ({
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-success-token"),
}))

jest.mock("@/lib/cross-sell-token", () => ({
    __esModule: true,
    verifyCsToken: jest.fn(),
    generateCsToken: jest.fn(),
}))

jest.mock("@/lib/cross-sell", () => ({
    __esModule: true,
    resolveCrossSellDiscounts: jest.fn(),
}))

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
        basePromoDiscountPercent: 5,
    }
    ;(global as { __csCfgMock?: typeof mock }).__csCfgMock = mock
    return { config: mock, getConfig: () => mock }
})

function getCfg() {
    return (global as { __csCfgMock?: Record<string, unknown> }).__csCfgMock!
}

function req(body: unknown, cookies?: { get: (n: string) => { value: string } | undefined }): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

const product = {
    id: "prod_1",
    name: "Test Product",
    slug: "test",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("100"),
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
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
}

const baseOrder = {
    id: "order_new",
    orderNo: "550e8400-e29b-41d4-a716-446655440000",
    productId: "prod_1",
    distributorId: null,
    email: "user@example.com",
    passwordHash: "hashed-password",
    quantity: 1,
    amount: new Prisma.Decimal("90"),
    discountPercentApplied: null,
    productNameSnapshot: null,
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

function mockTx(order = baseOrder) {
    const tx = {
        order: { create: jest.fn().mockResolvedValue(order) },
        card: {
            findMany: jest.fn().mockResolvedValue([{ id: "card_1" }]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        crossSellUsage: { create: jest.fn().mockResolvedValue({}) },
        exitDiscountUsage: { create: jest.fn().mockResolvedValue({}) },
    }
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
    )
    return tx
}

const validCsPayload = {
    sourceOrderId: "order_src",
    exp: Date.now() + 1_800_000,
}

const sourceOrderRow = { email: "user@example.com" }

const baseBody = {
    productId: "prod_1",
    email: "user@example.com",
    orderPassword: "password123",
    quantity: 1,
    cs: "valid.cs.token",
}

describe("POST /api/orders — cross-sell discount (cs token model)", () => {
    const verifyCsToken = require("@/lib/cross-sell-token").verifyCsToken as jest.Mock
    const resolveCrossSellDiscounts = require("@/lib/cross-sell").resolveCrossSellDiscounts as jest.Mock
    const verifyExitDiscountToken = require("@/lib/exit-discount").verifyExitDiscountToken as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        getCfg().turnstileSecretKey = undefined
        getCfg().exitDiscountSecret = "test-exit-secret"
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        verifyCsToken.mockReturnValue({ valid: false })
        resolveCrossSellDiscounts.mockResolvedValue(new Map())
        verifyExitDiscountToken.mockReturnValue({ valid: false })
    })

    // ─── Happy path ───────────────────────────────────────────────────────────

    it("applies discount when cs token valid + source email matches + resolve returns percent", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        const res = await POST(req(baseBody))
        expect(res.status).toBe(200)

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
    })

    it("writes CrossSellUsage in transaction when discount applied", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        await POST(req(baseBody))

        expect(tx.crossSellUsage.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                sourceOrderId: "order_src",
                targetProductId: "prod_1",
                discountPercent: 10,
            }),
        })
    })

    // ─── Token integrity ──────────────────────────────────────────────────────

    it("falls back to full price when cs token HMAC invalid (forged)", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: false })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(data.discountPercentApplied).toBeUndefined()
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
        // Resolver should not have been called when token verification fails
        expect(resolveCrossSellDiscounts).not.toHaveBeenCalled()
    })

    // ─── Email binding (prevents link sharing) ────────────────────────────────

    it("falls back to full price when buyer email differs from source order email", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce({ email: "other@example.com" } as any)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
        expect(resolveCrossSellDiscounts).not.toHaveBeenCalled()
    })

    it("falls back to full price when source order not found", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    it("email comparison is case-insensitive (USER@EXAMPLE.COM matches user@example.com)", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        await POST(req({ ...baseBody, email: "USER@EXAMPLE.COM" }))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
    })

    // ─── Resolver returns null (any reason) ───────────────────────────────────

    it("falls back to full price when resolveCrossSellDiscounts returns empty map", async () => {
        // Resolver returning null could be: TTL expired, source not COMPLETED,
        // disabled setting, not in eligible targets, already used. The route
        // doesn't need to distinguish — it treats null uniformly as "no discount".
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map())
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    // ─── Discount stacking prevention ─────────────────────────────────────────

    it("cross-sell + promoCode: only cross-sell discount applied", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "dist_1",
            discountCodeEnabled: true,
            discountPercent: new Prisma.Decimal("15"),
        } as any)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        await POST(req({ ...baseBody, promoCode: "DIST15" }))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
    })

    it("cross-sell + exitDiscountToken: only cross-sell applied, exit usage NOT written", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        verifyExitDiscountToken.mockReturnValueOnce({
            valid: true,
            payload: {
                productId: "prod_1",
                visitorId: "v1",
                fingerprintHash: "fp1",
                ip: "127.0.0.1",
                discountPercent: 5,
                exp: Date.now() + 900_000,
            },
        })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        await POST(req({ ...baseBody, exitDiscountToken: "valid.exit.token" }))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
        expect(tx.exitDiscountUsage.create).not.toHaveBeenCalled()
    })

    it("cross-sell + promoCode + exitDiscount: only cross-sell applied", async () => {
        verifyCsToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(sourceOrderRow as any)
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map([["prod_1", 10]]))
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "dist_1",
            discountCodeEnabled: true,
            discountPercent: new Prisma.Decimal("15"),
        } as any)
        verifyExitDiscountToken.mockReturnValueOnce({
            valid: true,
            payload: {
                productId: "prod_1",
                visitorId: "v1",
                fingerprintHash: "fp1",
                ip: "127.0.0.1",
                discountPercent: 5,
                exp: Date.now() + 900_000,
            },
        })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        await POST(req({ ...baseBody, promoCode: "DIST15", exitDiscountToken: "valid.exit.token" }))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
        expect(tx.exitDiscountUsage.create).not.toHaveBeenCalled()
    })
})
