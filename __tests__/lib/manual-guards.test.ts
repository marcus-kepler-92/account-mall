/**
 * Guards that exclude MANUAL products from card-based growth/abuse-control
 * features (restock notifications, purchase-limit, cross-sell). Each guard
 * short-circuits *before* hitting the DB so the feature can never be wired
 * to MANUAL products by accident.
 */
import { Prisma } from "@prisma/client"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
  config: {
    siteName: "Account Mall",
    siteUrl: "http://localhost:3000",
    crossSellTokenSecret: "test-cross-sell-secret-16chars!!",
    betterAuthSecret: "fallback-secret-16chars!!",
  },
}))

jest.mock("@/lib/email", () => ({
  __esModule: true,
  sendMail: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock("@react-email/render", () => ({
  render: jest.fn().mockResolvedValue("<html><body>stub</body></html>"),
}))

import { sendMail } from "@/lib/email"
import { notifyRestockSubscribers } from "@/lib/restock-notify"
import { checkPurchaseLimit } from "@/lib/purchase-limit"
import { getCrossSellRecommendations } from "@/lib/cross-sell"

describe("MANUAL product guards", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("notifyRestockSubscribers", () => {
    it("returns immediately for MANUAL product without touching the DB", async () => {
      await notifyRestockSubscribers({
        id: "prod_manual",
        name: "Manual Product",
        slug: "manual-product",
        price: 99,
        productType: "MANUAL",
      })

      expect(prismaMock.restockSubscription.findMany).not.toHaveBeenCalled()
      expect(prismaMock.restockSubscription.updateMany).not.toHaveBeenCalled()
      expect(sendMail).not.toHaveBeenCalled()
    })
  })

  describe("checkPurchaseLimit", () => {
    it("returns blocked=false for MANUAL product without touching the DB", async () => {
      const result = await checkPurchaseLimit({
        productId: "prod_manual",
        email: "buyer@example.com",
        fingerprintHash: "fp-1",
        clientIp: "1.2.3.4",
        limitQuantity: 1,
        productType: "MANUAL",
      })

      expect(result).toEqual({ blocked: false, message: "" })
      expect(prismaMock.order.count).not.toHaveBeenCalled()
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
    })
  })

  describe("getCrossSellRecommendations", () => {
    it("skips MANUAL products in the candidate pool", async () => {
      const sourceProductId = "source-prod"

      prismaMock.productCrossSell.findMany.mockResolvedValue([])
      prismaMock.product.findUnique.mockResolvedValue({
        id: sourceProductId,
        tags: [{ id: "tag-1", name: "Gaming", slug: "gaming" }],
      } as any)
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: "prod-manual",
          name: "Manual SKU",
          slug: "manual-sku",
          description: null,
          summary: null,
          image: null,
          price: new Prisma.Decimal("99.00"),
          status: "ACTIVE",
          productType: "MANUAL",
          sortOrder: 0,
          tags: [],
        },
        {
          id: "prod-normal",
          name: "Normal",
          slug: "normal",
          description: null,
          summary: null,
          image: null,
          price: new Prisma.Decimal("19.00"),
          status: "ACTIVE",
          productType: "NORMAL",
          sortOrder: 1,
          tags: [],
        },
      ] as any)
      prismaMock.card.count.mockResolvedValue(3)

      const results = await getCrossSellRecommendations(sourceProductId, 3)
      const ids = results.map((r) => r.id)

      expect(ids).not.toContain("prod-manual")
      expect(ids).toContain("prod-normal")
    })
  })
})
