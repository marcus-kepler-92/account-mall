/**
 * Unit tests for lib/purchase-limit.ts
 */
import { checkPurchaseLimit } from "@/lib/purchase-limit"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

const BASE_PARAMS = {
  productId: "prod_1",
  email: "user@example.com",
  fingerprintHash: null,
  clientIp: "1.2.3.4",
  limitQuantity: 1,
}

describe("checkPurchaseLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("blocking logic", () => {
    it("count=0 → not blocked", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.blocked).toBe(false)
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })

    it("count=1, limitQuantity=1 → blocked", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "order-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.blocked).toBe(true)
    })

    it("count=1, limitQuantity=2 → not blocked", async () => {
      prismaMock.order.count.mockResolvedValue(1)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.blocked).toBe(false)
    })

    it("count=2, limitQuantity=2 → blocked", async () => {
      prismaMock.order.count.mockResolvedValue(2)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "order-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.blocked).toBe(true)
    })

    it("error message includes limitQuantity and count", async () => {
      prismaMock.order.count.mockResolvedValue(3)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit({ ...BASE_PARAMS, limitQuantity: 2 })

      expect(result.message).toContain("2")
      expect(result.message).toContain("3")
    })
  })

  describe("orderNo security", () => {
    it("blocked, email matches → orderNo exposed", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "own-uuid",
        email: "user@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.orderNo).toBe("own-uuid")
    })

    it("blocked, email differs (fingerprint/IP match) → orderNo not exposed", async () => {
      prismaMock.order.count.mockResolvedValue(1)
      prismaMock.order.findFirst.mockResolvedValue({
        orderNo: "other-uuid",
        email: "other@example.com",
      } as any)

      const result = await checkPurchaseLimit(BASE_PARAMS)

      expect(result.orderNo).toBeUndefined()
    })
  })

  describe("multi-factor WHERE condition", () => {
    it("no fingerprint, no IP — only email signal in OR", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: null, clientIp: "unknown" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      expect(orCondition).toHaveLength(1)
      expect((orCondition[0] as any).email).toBe("user@example.com")
    })

    it("fingerprint provided — fingerprint signal requires corroboration (OR sub-condition)", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: "fp-abc" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const fpEntry = orCondition.find((c) => (c as any).fingerprintHash === "fp-abc") as any
      expect(fpEntry).toBeDefined()
      expect(fpEntry.OR).toBeDefined()
      expect((fpEntry.OR as object[]).length).toBeGreaterThan(0)
    })

    it("IP signal requires corroboration — has OR sub-condition with email or fingerprint", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, fingerprintHash: "fp-abc" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const ipEntry = orCondition.find((c) => (c as any).clientIp === "1.2.3.4") as any
      expect(ipEntry).toBeDefined()
      expect(ipEntry.OR).toBeDefined()
      const ipSubOR = ipEntry.OR as object[]
      const hasEmail = ipSubOR.some((c) => (c as any).email !== undefined)
      expect(hasEmail).toBe(true)
    })

    it("unknown IP — no IP auxiliary signal added", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, clientIp: "unknown" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const hasIp = orCondition.some((c) => (c as any).clientIp !== undefined)
      expect(hasIp).toBe(false)
    })

    it("WHERE always filters productId and status=COMPLETED", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit(BASE_PARAMS)

      const call = prismaMock.order.count.mock.calls[0]![0]!
      expect((call.where as any).productId).toBe("prod_1")
      expect((call.where as any).status).toBe("COMPLETED")
    })

    it("email is lowercased before use in WHERE", async () => {
      prismaMock.order.count.mockResolvedValue(0)

      await checkPurchaseLimit({ ...BASE_PARAMS, email: "USER@Example.COM" })

      const call = prismaMock.order.count.mock.calls[0]![0]!
      const orCondition = (call.where as any).OR as object[]
      const emailEntry = orCondition.find((c) => (c as any).email !== undefined) as any
      expect(emailEntry.email).toBe("user@example.com")
    })
  })
})
