/**
 * MANUAL product create-order flow:
 * - variantId is required for MANUAL products
 * - variant must belong to the same product
 * - variant must be active and have stockQuantity >= 1
 * - Snapshots variant.name + variant.price onto the order
 * - Forces quantity to 1
 * - Does NOT touch the cards reservation logic (no Card.create/updateMany)
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/route"
import { prismaMock } from "../../../__mocks__/prisma"
import { Prisma } from "@prisma/client"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
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
    getPaymentUrlForOrder: jest.fn().mockReturnValue("https://pay.example.com/pay"),
}))

jest.mock("@/lib/config", () => {
    const mock = {
        turnstileSecretKey: undefined as string | undefined,
        nodeEnv: "test" as string,
        siteUrl: "http://localhost:3000",
        basePromoDiscountPercent: 5,
    }
    ;(global as { __configMockManual?: typeof mock }).__configMockManual = mock
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

function createJsonRequest(
    body: unknown,
    cookies?: { get: (name: string) => { value: string } | undefined },
): NextRequest {
    return {
        json: async () => body,
        cookies: cookies ?? { get: () => undefined },
    } as unknown as NextRequest
}

// CUIDs (25 chars, starting with "c") — pass z.cuid() validation
const PRODUCT_ID = "cmanualproduct000000000001"
const VARIANT_ID = "cmanualvariant000000000001"

function makeManualProduct(overrides?: Partial<Record<string, unknown>>) {
    return {
        id: PRODUCT_ID,
        name: "Manual Product",
        slug: "manual-product",
        summary: null,
        description: null,
        image: null,
        price: new Prisma.Decimal("100"),
        maxQuantity: 5,
        status: "ACTIVE",
        productType: "MANUAL",
        // Default fixtures use tracked inventory because they exercise the
        // stock-related branches; untracked variants get their own test below.
        inventoryTracked: true,
        sourceUrl: null,
        validityHours: null,
        allowAccountSwitch: true,
        accountSwitchLimit: 1,
        couponEnabled: false,
        excludeFromAttribution: false,
        purchaseLimitEnabled: false,
        purchaseLimitQuantity: null,
        riskWarningEnabled: false,
        riskWarningTitle: null,
        riskWarningContent: null,
        riskWarningCountdown: null,
        riskWarningConfirmText: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

function makeVariant(overrides?: Partial<Record<string, unknown>>) {
    return {
        id: VARIANT_ID,
        productId: PRODUCT_ID,
        name: "10K 钻石",
        price: new Prisma.Decimal("88.50"),
        unitCost: new Prisma.Decimal("20"),
        stockQuantity: 5,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }
}

function setupOrderCreateCapture(captureRef: { data?: Record<string, unknown> }) {
    return (prismaMock.order.create as jest.Mock).mockImplementation(
        async (args: { data: Record<string, unknown> }) => {
            captureRef.data = args.data
            return {
                id: "order_manual_1",
                orderNo: "uuid-manual",
                ...args.data,
            }
        },
    )
}

describe("POST /api/orders — MANUAL branch", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(prismaMock.$transaction as jest.Mock).mockReset()
        ;(prismaMock.paymentChannel.findMany as jest.Mock).mockResolvedValue([])
    })

    it("rejects MANUAL order missing variantId", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(makeManualProduct() as any)

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                quantity: 1,
            }),
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
        // validationError(fieldErrors) → details carries our { variantId: [...] } map
        expect(data.details).toMatchObject({ variantId: expect.arrayContaining([expect.stringMatching(/必须|规格/)]) })
        // No DB write attempted
        expect(prismaMock.order.create).not.toHaveBeenCalled()
    })

    it("rejects when variant belongs to a different product", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(makeManualProduct() as any)
        prismaMock.productVariant.findUnique.mockResolvedValueOnce(
            makeVariant({ productId: "cdifferentproduct000000001" }) as any,
        )

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                quantity: 1,
                variantId: VARIANT_ID,
            }),
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.details).toMatchObject({ variantId: expect.arrayContaining([expect.stringMatching(/不存在/)]) })
        expect(prismaMock.order.create).not.toHaveBeenCalled()
    })

    it("rejects when variant is inactive", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(makeManualProduct() as any)
        prismaMock.productVariant.findUnique.mockResolvedValueOnce(
            makeVariant({ isActive: false }) as any,
        )

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                quantity: 1,
                variantId: VARIANT_ID,
            }),
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.details).toMatchObject({ variantId: expect.arrayContaining([expect.stringMatching(/停售/)]) })
        expect(prismaMock.order.create).not.toHaveBeenCalled()
    })

    it("rejects when variant stockQuantity is 0", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(makeManualProduct() as any)
        prismaMock.productVariant.findUnique.mockResolvedValueOnce(
            makeVariant({ stockQuantity: 0 }) as any,
        )

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                quantity: 1,
                variantId: VARIANT_ID,
            }),
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.details).toMatchObject({ variantId: expect.arrayContaining([expect.stringMatching(/售罄/)]) })
        expect(prismaMock.order.create).not.toHaveBeenCalled()
    })

    it("MANUAL+untracked allows ordering a variant with stockQuantity=0", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(
            makeManualProduct({ inventoryTracked: false }) as any,
        )
        prismaMock.productVariant.findUnique.mockResolvedValueOnce(
            makeVariant({ stockQuantity: 0 }) as any,
        )

        const capture: { data?: Record<string, unknown> } = {}
        setupOrderCreateCapture(capture)

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                quantity: 1,
                variantId: VARIANT_ID,
            }),
        )

        expect(res.status).toBe(200)
        expect(capture.data).toMatchObject({
            productId: PRODUCT_ID,
            variantId: VARIANT_ID,
            quantity: 1,
            status: "PENDING",
        })
    })

    it("writes variantId / variantNameSnapshot / unitPriceSnapshot=variant.price and forces quantity to 1", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(makeManualProduct() as any)
        prismaMock.productVariant.findUnique.mockResolvedValueOnce(makeVariant() as any)

        const capture: { data?: Record<string, unknown> } = {}
        setupOrderCreateCapture(capture)

        const res = await POST(
            createJsonRequest({
                productId: PRODUCT_ID,
                email: "buyer@example.com",
                orderPassword: "password123",
                // Client sends 5; MANUAL must coerce to 1.
                quantity: 5,
                variantId: VARIANT_ID,
            }),
        )

        expect(res.status).toBe(200)
        expect(capture.data).toBeDefined()
        expect(capture.data).toMatchObject({
            productId: PRODUCT_ID,
            email: "buyer@example.com",
            variantId: VARIANT_ID,
            variantNameSnapshot: "10K 钻石",
            quantity: 1,
            status: "PENDING",
        })
        // unitPriceSnapshot must equal variant.price (Prisma Decimal compares numerically via Number())
        expect(Number(capture.data!.unitPriceSnapshot)).toBe(88.5)
        // amount must equal variant.price * 1
        expect(Number(capture.data!.amount)).toBe(88.5)
        // MANUAL must NOT touch the cards reservation transaction
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })
})
