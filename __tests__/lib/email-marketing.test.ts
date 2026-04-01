jest.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

import { prismaMock } from "@/__mocks__/prisma"
import { resolveRecipients } from "@/lib/email-marketing"

describe("resolveRecipients", () => {
  describe("CUSTOMERS", () => {
    it("queries completed orders with no filter", async () => {
      prismaMock.order.findMany.mockResolvedValue([
        { email: "a@example.com" } as never,
        { email: "b@example.com" } as never,
      ])

      const emails = await resolveRecipients({
        type: "CUSTOMERS",
        filter: {},
      })

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "COMPLETED" }),
          select: { email: true },
          distinct: ["email"],
        })
      )
      expect(emails).toEqual(["a@example.com", "b@example.com"])
    })

    it("adds productId filter when productIds provided", async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      await resolveRecipients({
        type: "CUSTOMERS",
        filter: { productIds: ["p1", "p2"] },
      })

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            productId: { in: ["p1", "p2"] },
          }),
        })
      )
    })

    it("adds createdAt filter when dateFrom and dateTo provided", async () => {
      prismaMock.order.findMany.mockResolvedValue([])

      await resolveRecipients({
        type: "CUSTOMERS",
        filter: { dateFrom: "2025-01-01", dateTo: "2025-12-31" },
      })

      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date("2025-01-01"),
              lte: new Date("2025-12-31"),
            },
          }),
        })
      )
    })
  })

  describe("DISTRIBUTORS", () => {
    it("queries all non-disabled distributors for level=all", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { email: "dist@example.com" } as never,
      ])

      const emails = await resolveRecipients({
        type: "DISTRIBUTORS",
        filter: { level: "all" },
      })

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "DISTRIBUTOR",
            disabledAt: null,
          }),
          select: { email: true },
        })
      )
      expect(emails).toEqual(["dist@example.com"])
    })

    it("adds inviterId: null for level1", async () => {
      prismaMock.user.findMany.mockResolvedValue([])

      await resolveRecipients({
        type: "DISTRIBUTORS",
        filter: { level: "level1" },
      })

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ inviterId: null }),
        })
      )
    })

    it("adds inviterId: { not: null } for level2", async () => {
      prismaMock.user.findMany.mockResolvedValue([])

      await resolveRecipients({
        type: "DISTRIBUTORS",
        filter: { level: "level2" },
      })

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ inviterId: { not: null } }),
        })
      )
    })
  })
})
