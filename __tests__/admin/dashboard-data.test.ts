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
  getGlobalKPI,
  countInventoryAttentionProducts,
} from "@/app/admin/(main)/dashboard/dashboard-data"
import type { InventoryRow } from "@/app/admin/(main)/dashboard/types"

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
          where: { productType: "NORMAL", status: "ACTIVE" },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
      )
      expect(prismaMock.card.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: "UNSOLD",
            product: { productType: "NORMAL", status: "ACTIVE" },
          },
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

  describe("countInventoryAttentionProducts", () => {
    it("counts rows where isLowStock is true", () => {
      const rows: InventoryRow[] = [
        { productId: "a", productName: "A", unsoldCount: 0, isLowStock: true },
        { productId: "b", productName: "B", unsoldCount: 5, isLowStock: false },
        { productId: "c", productName: "C", unsoldCount: 2, isLowStock: true },
      ]
      expect(countInventoryAttentionProducts(rows)).toBe(2)
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

  describe("getGlobalKPI", () => {
    // Promise.all order: order.findMany (paid+free today), user.count (new
    // distributors), order.aggregate (refund sum), order.count (fulfillment backlog).
    function mockKPI(opts: {
      orders?: { amount: number }[]
      newDistributors?: number
      refundSum?: number | string | null
      awaiting?: number
    }) {
      prismaMock.order.findMany.mockResolvedValueOnce((opts.orders ?? []) as any)
      prismaMock.user.count.mockResolvedValueOnce(opts.newDistributors ?? 0)
      prismaMock.order.aggregate.mockResolvedValueOnce({
        _sum: { amount: opts.refundSum ?? null },
      } as any)
      prismaMock.order.count.mockResolvedValueOnce(opts.awaiting ?? 0)
    }

    it("splits free (amount 0) vs paid (amount > 0) and computes conversion", async () => {
      mockKPI({
        orders: [{ amount: 0 }, { amount: 0 }, { amount: 0 }, { amount: 100 }],
      })

      const result = await getGlobalKPI()

      // 1 paid out of 4 total → 25%
      expect(result.todayFreeCount).toBe(3)
      expect(result.todayPaidCount).toBe(1)
      expect(result.todayConversionRate).toBeCloseTo(0.25, 5)
    })

    it("returns 0 conversion when there are no orders", async () => {
      mockKPI({ orders: [] })

      const result = await getGlobalKPI()

      expect(result.todayFreeCount).toBe(0)
      expect(result.todayPaidCount).toBe(0)
      expect(result.todayConversionRate).toBe(0)
    })

    it("passes through new distributors, refund amount and fulfillment backlog", async () => {
      mockKPI({ orders: [], newDistributors: 4, refundSum: "59.5", awaiting: 7 })

      const result = await getGlobalKPI()

      expect(result.todayNewDistributors).toBe(4)
      expect(result.todayRefundAmount).toBeCloseTo(59.5, 2)
      expect(result.awaitingFulfillmentCount).toBe(7)
    })

    it("treats a null refund sum as 0", async () => {
      mockKPI({ orders: [], refundSum: null })

      const result = await getGlobalKPI()

      expect(result.todayRefundAmount).toBe(0)
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
