/**
 * Integration tests: purchase limit check in POST /api/orders.
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
  }
  ;(global as { __configMockPL?: typeof mock }).__configMockPL = mock
  return { config: mock, getConfig: () => mock }
})

jest.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: jest.fn() }))
jest.mock("@/lib/complete-pending-order", () => ({ completePendingOrder: jest.fn() }))
jest.mock("@/lib/order-success-token", () => ({
  createOrderSuccessToken: jest.fn().mockReturnValue("mock-token"),
}))
jest.mock("@/lib/scrape-shared-accounts", () => ({
  scrapeMultipleUrls: jest.fn().mockResolvedValue([]),
}))
jest.mock("@/lib/payment-channel", () => ({
  selectPaymentChannel: jest.fn().mockResolvedValue(null),
}))
jest.mock("@/lib/turnstile-policy", () => ({
  isStorefrontTurnstileEnforced: jest.fn().mockReturnValue(false),
}))
jest.mock("@/lib/exit-discount", () => ({
  verifyExitDiscountToken: jest.fn().mockReturnValue({ valid: false }),
}))

function getConfig() {
  return (global as { __configMockPL?: Record<string, unknown> }).__configMockPL!
}

function makeNormalProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_normal",
    name: "Normal Product",
    slug: "normal-product",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("29.90"),
    maxQuantity: 10,
    status: "ACTIVE",
    productType: "NORMAL",
    sourceUrl: null,
    validityHours: null,
    allowAccountSwitch: false,
    accountSwitchLimit: 1,
    couponEnabled: false,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
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
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
    ...overrides,
  } as any
}

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
  } as unknown as NextRequest
}

const BASE_BODY = {
  productId: "prod_normal",
  email: "user@example.com",
  orderPassword: "password123",
  quantity: 1,
  paymentMethod: "alipay",
}

describe("POST /api/orders — purchase limit check", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getConfig().nodeEnv = "test"
    prismaMock.user.findFirst.mockResolvedValue(null)
  })

  describe("NORMAL product — purchaseLimitEnabled=false", () => {
    it("limit disabled → proceeds without purchase limit count query", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeNormalProduct({ purchaseLimitEnabled: false }))
      prismaMock.order.count.mockResolvedValue(0) // pending IP check
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({
        id: "o1",
        orderNo: "uuid-1",
        amount: new Prisma.Decimal("29.90"),
      })

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).not.toBe(429)
      // Only 1 count call (pending IP check), not 2
      expect(prismaMock.order.count).toHaveBeenCalledTimes(1)
    })
  })

  describe("NORMAL product — purchaseLimitEnabled=true, limitQuantity=1", () => {
    it("no previous orders → proceeds (count=0 for purchase limit)", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(0) // purchase limit: no previous COMPLETED orders
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({
        id: "o1",
        orderNo: "uuid-1",
        amount: new Prisma.Decimal("29.90"),
      })

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).not.toBe(429)
    })

    it("1 previous COMPLETED order → 429 with limit message", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: 1 existing
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "prev-order-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.error).toContain("限购")
    })

    it("blocked with own email → response includes orderNo", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit blocked
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "own-order-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBe("own-order-uuid")
    })

    it("blocked via fingerprint (other user email) → response hides orderNo", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit blocked
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "other-user-uuid",
        email: "other@example.com",
      } as any)

      const res = await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-shared" }))
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBeUndefined()
    })
  })

  describe("NORMAL product — limitQuantity=2", () => {
    it("1 previous order → not blocked (below limit)", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 2 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: only 1 existing, limit is 2
      prismaMock.card.count.mockResolvedValue(5)
      prismaMock.$transaction.mockResolvedValue({
        id: "o1",
        orderNo: "uuid-1",
        amount: new Prisma.Decimal("29.90"),
      })

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).not.toBe(429)
    })

    it("2 previous orders → blocked", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeNormalProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 2 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(2) // purchase limit: 2 existing = limitQuantity
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "prev-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).toBe(429)
    })
  })

  describe("AUTO_FETCH product — purchaseLimitEnabled=true", () => {
    it("1 previous COMPLETED order → 429", async () => {
      const { scrapeMultipleUrls } = require("@/lib/scrape-shared-accounts")
      ;(scrapeMultipleUrls as jest.Mock).mockResolvedValue([])

      prismaMock.product.findUnique.mockResolvedValue(
        makeAutoFetchProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(1) // purchase limit: 1 existing
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "af-prev-uuid",
        email: "user@example.com",
      } as any)

      const res = await POST(makeRequest({ ...BASE_BODY, productId: "prod_af" }))

      expect(res.status).toBe(429)
    })

    it("0 previous orders → proceeds past limit check to AUTO_FETCH flow", async () => {
      const { scrapeMultipleUrls } = require("@/lib/scrape-shared-accounts")
      ;(scrapeMultipleUrls as jest.Mock).mockResolvedValue([
        { account: "shared@apple.com", password: "Pass123!", region: "US", status: "valid" },
      ])

      prismaMock.product.findUnique.mockResolvedValue(
        makeAutoFetchProduct({ purchaseLimitEnabled: true, purchaseLimitQuantity: 1 }),
      )
      prismaMock.order.count
        .mockResolvedValueOnce(0) // pending IP check
        .mockResolvedValueOnce(0) // purchase limit: no previous
      prismaMock.accountBlacklist.findMany.mockResolvedValue([])
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: { create: jest.fn().mockResolvedValue({ id: "o1", orderNo: "uuid-1" }) },
          card: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
        }
        await fn(tx)
        return { orderNo: "uuid-1" }
      })

      const res = await POST(makeRequest({ ...BASE_BODY, productId: "prod_af" }))

      expect(res.status).toBe(200)
    })
  })
})
