import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

import {
  getDashboardTrend,
  getTopProductsByRevenue,
  getInventoryByProduct,
  getRestockPending,
  getRecentOrders,
  getDashboardData,
} from "@/app/admin/(main)/dashboard/dashboard-data"

const now = new Date("2024-02-14T12:00:00.000Z")

describe("dashboard-data", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(now)
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  describe("getDashboardTrend", () => {
    it("returns array of length equal to days with 净收入 field", async () => {
      prismaMock.order.groupBy.mockResolvedValueOnce([])
      prismaMock.commission.groupBy.mockResolvedValueOnce([])

      const result = await getDashboardTrend(7)

      expect(result).toHaveLength(7)
      expect(
        result.every(
          (r) =>
            typeof r.date === "string" &&
            typeof r.订单 === "number" &&
            typeof r.营收 === "number" &&
            typeof r.净收入 === "number",
        ),
      ).toBe(true)
    })

    it("queries all non-CANCELLED commissions for 净收入 calculation", async () => {
      prismaMock.order.groupBy.mockResolvedValueOnce([])
      prismaMock.commission.groupBy.mockResolvedValueOnce([])

      await getDashboardTrend(7)

      expect(prismaMock.commission.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: "CANCELLED" },
          }),
        }),
      )
    })

    it("calculates 净收入 as revenue minus commission for each day", async () => {
      const testDay = new Date("2024-02-13T12:00:00.000Z")
      prismaMock.order.groupBy.mockResolvedValueOnce([
        { paidAt: testDay, _sum: { amount: 100 }, _count: { id: 1 } } as any,
      ])
      prismaMock.commission.groupBy.mockResolvedValueOnce([
        { createdAt: testDay, _sum: { amount: 20 } } as any,
      ])

      const result = await getDashboardTrend(7)
      const dayResult = result.find((r) => r.营收 === 100)
      expect(dayResult?.净收入).toBe(80)
    })
  })

  describe("getTopProductsByRevenue", () => {
    it("returns products sorted by revenue with names", async () => {
      prismaMock.order.groupBy.mockResolvedValueOnce([
        { productId: "p1", _sum: { amount: 500 }, _count: { id: 5 } } as any,
        { productId: "p2", _sum: { amount: 300 }, _count: { id: 3 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Product A" } as any,
        { id: "p2", name: "Product B" } as any,
      ])

      const result = await getTopProductsByRevenue(5)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ productId: "p1", productName: "Product A", revenue: 500, orderCount: 5 })
      expect(result[1].revenue).toBe(300)
    })
  })

  describe("getInventoryByProduct", () => {
    it("returns inventory rows with isLowStock flag", async () => {
      prismaMock.card.groupBy.mockResolvedValueOnce([
        { productId: "p1", _count: { id: 2 } } as any,
        { productId: "p2", _count: { id: 10 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Low Stock" } as any,
        { id: "p2", name: "OK Stock" } as any,
      ])

      const result = await getInventoryByProduct()

      expect(result).toHaveLength(2)
      expect(result.find((r) => r.productId === "p1")?.isLowStock).toBe(true)
      expect(result.find((r) => r.productId === "p2")?.isLowStock).toBe(false)
      expect(prismaMock.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
      )
    })

    it("includes products with zero unsold cards", async () => {
      prismaMock.card.groupBy.mockResolvedValueOnce([
        { productId: "p1", _count: { id: 5 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Has Stock" } as any,
        { id: "p2", name: "Empty" } as any,
      ])

      const result = await getInventoryByProduct()

      expect(result).toHaveLength(2)
      expect(result.find((r) => r.productId === "p2")).toMatchObject({
        unsoldCount: 0,
        isLowStock: true,
      })
    })
  })

  describe("getRestockPending", () => {
    it("returns pending count per product with names", async () => {
      prismaMock.restockSubscription.groupBy.mockResolvedValueOnce([
        { productId: "p1", _count: { id: 4 } } as any,
      ])
      prismaMock.product.findMany.mockResolvedValueOnce([
        { id: "p1", name: "Out of Stock" } as any,
      ])

      const result = await getRestockPending()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ productId: "p1", productName: "Out of Stock", pendingCount: 4 })
    })
  })

  describe("getRecentOrders", () => {
    it("returns orders with product relation", async () => {
      prismaMock.order.findMany.mockResolvedValueOnce([
        {
          id: "o1",
          orderNo: "NO001",
          productId: "p1",
          amount: 99,
          status: "COMPLETED",
          product: { id: "p1", name: "Prod" },
        } as any,
      ])

      const result = await getRecentOrders(10)

      expect(result).toHaveLength(1)
      expect(prismaMock.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: expect.objectContaining({ product: { select: { id: true, name: true } } }),
        }),
      )
    })
  })

  describe("getDashboardData", () => {
    it("returns all sections without kpis", async () => {
      prismaMock.order.groupBy.mockResolvedValue([])
      prismaMock.commission.groupBy.mockResolvedValue([])
      prismaMock.withdrawal.groupBy.mockResolvedValue([])
      prismaMock.card.groupBy.mockResolvedValue([])
      prismaMock.restockSubscription.groupBy.mockResolvedValue([])
      prismaMock.product.findMany.mockResolvedValue([])
      prismaMock.order.findMany.mockResolvedValue([])

      const result = await getDashboardData()

      expect(result).toHaveProperty("trend7")
      expect(result).toHaveProperty("trend30")
      expect(result).toHaveProperty("topProducts")
      expect(result).toHaveProperty("inventory")
      expect(result).toHaveProperty("restockPending")
      expect(result).toHaveProperty("recentOrders")
      expect(result).not.toHaveProperty("kpis")
      expect(result).not.toHaveProperty("orderStatusDistribution")
      expect(result.trend7).toHaveLength(7)
      expect(result.trend30).toHaveLength(30)
    })
  })
})
