/**
 * Security + correctness tests for cross-sell discount in POST /api/orders.
 *
 * Covers:
 *  - Happy path: valid token → discount applied, CrossSellUsage written
 *  - Forged / tampered token → full price, no usage record
 *  - Expired token → full price
 *  - Wrong targetProductId → full price
 *  - Wrong email (token belongs to different buyer) → full price
 *  - sourceOrder not COMPLETED → full price
 *  - sourceOrder not found → full price
 *  - Token already consumed (CrossSellUsage exists) → full price
 *  - Stacking: crossSell + promoCode → only crossSell applied
 *  - Stacking: crossSell + exitDiscount → only crossSell applied
 *  - crossSell + promoCode + exitDiscount together → only crossSell applied
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

// Mock verifyCrossSellToken so we can control its return value per test
jest.mock("@/lib/cross-sell-token", () => ({
    __esModule: true,
    verifyCrossSellToken: jest.fn(),
    generateCrossSellToken: jest.fn(),
}))

// Mock verifyExitDiscountToken so we can test stacking
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

/** Shared product fixture (¥100, NORMAL, ACTIVE) */
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

/** Build a mock transaction that creates an order and reserves 1 card */
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

/** Valid cross-sell token payload for prod_1, sourceOrder order_src, 10% off */
const validCsPayload = {
    sourceOrderId: "order_src",
    targetProductId: "prod_1",
    discountPercent: 10,
    exp: Date.now() + 1_800_000,
}

const completedSourceOrder = { status: "COMPLETED", email: "user@example.com" }

const baseBody = {
    productId: "prod_1",
    email: "user@example.com",
    orderPassword: "password123",
    quantity: 1,
    crossSellToken: "valid.cs.token",
}

describe("POST /api/orders — cross-sell discount security", () => {
    const verifyCrossSellToken = require("@/lib/cross-sell-token").verifyCrossSellToken as jest.Mock
    const verifyExitDiscountToken = require("@/lib/exit-discount").verifyExitDiscountToken as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        getCfg().turnstileSecretKey = undefined
        getCfg().exitDiscountSecret = "test-exit-secret"
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        ;(prismaMock.paymentChannel.findMany as jest.Mock).mockResolvedValue([])
        // Default: crossSell token invalid unless test overrides
        verifyCrossSellToken.mockReturnValue({ valid: false })
        verifyExitDiscountToken.mockReturnValue({ valid: false })
    })

    // ─── Happy path ───────────────────────────────────────────────────────────

    it("applies 10% discount when valid token, sourceOrder COMPLETED, email matches, no prior usage", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        const res = await POST(req(baseBody))
        expect(res.status).toBe(200)

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)           // 100 * 0.9
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
    })

    it("writes CrossSellUsage in transaction when discount applied", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
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

    it("falls back to full price when token HMAC is invalid (forged token)", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: false })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(data.discountPercentApplied).toBeUndefined()
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    it("falls back to full price when token is expired", async () => {
        verifyCrossSellToken.mockReturnValueOnce({
            valid: false, // expired tokens fail verifyCrossSellToken
        })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    // ─── targetProductId binding ──────────────────────────────────────────────

    it("falls back to full price when token targetProductId does not match productId", async () => {
        verifyCrossSellToken.mockReturnValueOnce({
            valid: true,
            payload: { ...validCsPayload, targetProductId: "prod_OTHER" },
        })
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    // ─── sourceOrder validation ───────────────────────────────────────────────

    it("falls back to full price when sourceOrder does not exist", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    it("falls back to full price when sourceOrder status is PENDING (not COMPLETED)", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce({
            status: "PENDING",
            email: "user@example.com",
        } as any)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    // ─── Email binding (prevents link sharing) ────────────────────────────────

    it("falls back to full price when buyer email differs from sourceOrder email", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        // sourceOrder belongs to a different email
        prismaMock.order.findUnique.mockResolvedValueOnce({
            status: "COMPLETED",
            email: "other@example.com",
        } as any)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody)) // buyer is user@example.com

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    it("email comparison is case-insensitive (USER@EXAMPLE.COM matches user@example.com)", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx()

        // Submit with uppercased email — route lowercases before comparing
        await POST(req({ ...baseBody, email: "USER@EXAMPLE.COM" }))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBeCloseTo(90, 2)
    })

    // ─── One-time use ─────────────────────────────────────────────────────────

    it("falls back to full price when CrossSellUsage already exists (token reuse)", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        // Usage already consumed
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce({ id: "existing" } as any)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
        expect(tx.crossSellUsage.create).not.toHaveBeenCalled()
    })

    // ─── Discount stacking prevention ─────────────────────────────────────────

    it("cross-sell + promoCode: only cross-sell discount applied, promoCode zeroed out", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
        // Distributor with 15% coupon discount
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
        // Should be 100 * 0.9 = 90, NOT 100 * 0.85 * 0.9 = 76.5
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
    })

    it("cross-sell + exitDiscountToken: only cross-sell discount applied, exit discount zeroed out", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
        // Exit discount token also present and valid
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
        // Should be 100 * 0.9 = 90, NOT 100 * 0.95 * 0.9 = 85.5
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
        // Exit discount usage must NOT be written
        expect(tx.exitDiscountUsage.create).not.toHaveBeenCalled()
    })

    it("cross-sell + promoCode + exitDiscount: only cross-sell applied", async () => {
        verifyCrossSellToken.mockReturnValueOnce({ valid: true, payload: validCsPayload })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
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
        // Only cross-sell: 100 * 0.9 = 90
        expect(data.amount).toBeCloseTo(90, 2)
        expect(data.discountPercentApplied).toBeCloseTo(10, 1)
        expect(tx.exitDiscountUsage.create).not.toHaveBeenCalled()
    })

    // ─── No discount configured (discountPercent = 0 in token) ───────────────

    it("creates order at full price when token discountPercent is 0", async () => {
        verifyCrossSellToken.mockReturnValueOnce({
            valid: true,
            payload: { ...validCsPayload, discountPercent: 0 },
        })
        prismaMock.order.findUnique.mockResolvedValueOnce(completedSourceOrder as any)
        prismaMock.crossSellUsage.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.findUnique.mockResolvedValueOnce(product as any)
        prismaMock.card.count.mockResolvedValueOnce(5)
        const tx = mockTx({ ...baseOrder, amount: new Prisma.Decimal("100") })

        await POST(req(baseBody))

        const { data } = (tx.order.create as jest.Mock).mock.calls[0][0]
        expect(data.amount).toBe(100)
    })
})
