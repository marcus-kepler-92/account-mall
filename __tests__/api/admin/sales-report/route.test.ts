import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/sales-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }
const NO_BONUS: any[] = []
const PAID_AT = new Date("2025-03-17T04:00:00Z") // 2025-03-17 12:00 HKT

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/sales-report")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

describe("GET /api/admin/sales-report", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when from param is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ to: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when to param is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from > to", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-03-18", to: "2025-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from is an invalid calendar date", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-02-30", to: "2025-03-01" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when to is an invalid calendar date", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2025-03-01", to: "2025-13-01" }))
    expect(res.status).toBe(400)
  })

  it("returns empty data when no orders in range", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)
    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toEqual({ orderCount: 0, totalQuantity: 0, revenue: 0, cost: 0, hasMissingCost: false, milestoneBonus: 0, profit: 0 })
    expect(body.products).toEqual([])
  })

  it("aggregates orders by product with commissions", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)

    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        productId: "p1",
        productNameSnapshot: "王者荣耀点券",
        quantity: 2,
        amount: "129.60" as any,
        costSnapshot: null,
        costTotalSnapshot: null,
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o2",
        productId: "p1",
        productNameSnapshot: "王者荣耀点券",
        quantity: 1,
        amount: "64.80" as any,
        costSnapshot: null,
        costTotalSnapshot: null,
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o3",
        productId: "p2",
        productNameSnapshot: null,
        quantity: 1,
        amount: "38.00" as any,
        costSnapshot: null,
        costTotalSnapshot: null,
        product: { name: "网易云会员" },
      },
    ] as any)

    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "13.00" as any } },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.orderCount).toBe(3)
    expect(body.summary.totalQuantity).toBe(4)
    expect(body.summary.revenue).toBeCloseTo(232.4, 2)
    expect(body.summary.milestoneBonus).toBe(0)
    expect(body.summary.profit).toBeCloseTo(219.4, 2)

    const p1 = body.products.find((p: any) => p.productId === "p1")
    expect(p1.productName).toBe("王者荣耀点券")
    expect(p1.quantity).toBe(3)
    expect(p1.revenue).toBeCloseTo(194.4, 2)
    expect(p1.commission).toBeCloseTo(13, 2)
    expect(p1.profit).toBeCloseTo(181.4, 2)
    expect(p1.avgPrice).toBeCloseTo(64.8, 2)

    const p2 = body.products.find((p: any) => p.productId === "p2")
    expect(p2.productName).toBe("网易云会员")
    expect(p2.quantity).toBe(1)
    expect(p2.revenue).toBeCloseTo(38, 2)
    expect(p2.commission).toBe(0)
    expect(p2.profit).toBeCloseTo(38, 2)
  })

  it("keeps profit at 0 when no orders, even if milestone fired in range", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { amount: "500.00" as any, createdAt: PAID_AT },
    ] as any)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()

    expect(body.summary.revenue).toBe(0)
    expect(body.summary.milestoneBonus).toBeCloseTo(500, 2)
    expect(body.summary.profit).toBe(0)
    expect(body.series[0].profit).toBe(0)
  })

  it("surfaces milestone bonus separately in summary, without deducting from profit", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      { id: "o1", productId: "p1", productNameSnapshot: "商品A", quantity: 1, amount: "200.00" as any, costSnapshot: null, costTotalSnapshot: null, product: { name: "商品A" } },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "10.00" as any } },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { amount: "30.00" as any, createdAt: PAID_AT },
    ] as any)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()

    expect(body.summary.revenue).toBeCloseTo(200, 2)
    expect(body.summary.milestoneBonus).toBeCloseTo(30, 2)
    // Operational profit = 200 - 10 (commission); milestone bonus is reported separately
    // because it rewards cumulative invitee spending, not period operations.
    expect(body.summary.profit).toBeCloseTo(190, 2)
  })

  it("includes PENDING and WITHDRAWN commissions in profit deduction", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      { id: "o1", productId: "p1", productNameSnapshot: "商品A", quantity: 1, amount: "100.00" as any, costSnapshot: null, costTotalSnapshot: null, product: { name: "商品A" } },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "15.00" as any } },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))

    expect(prismaMock.commission.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: "CANCELLED" },
        }),
      }),
    )
  })

  it("sorts products by profit descending", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      { id: "o1", productId: "p1", productNameSnapshot: "A", quantity: 1, amount: "10.00" as any, costSnapshot: null, costTotalSnapshot: null, product: { name: "A" } },
      { id: "o2", productId: "p2", productNameSnapshot: "B", quantity: 1, amount: "50.00" as any, costSnapshot: null, costTotalSnapshot: null, product: { name: "B" } },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()
    expect(body.products[0].productId).toBe("p2")
    expect(body.products[1].productId).toBe("p1")
  })

  it("uses costTotalSnapshot directly (no quantity multiplier) for new orders", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 3,
        amount: "30.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "9.00" as any, // total cost for 3 cards, NOT multiplied by quantity
        product: { name: "A" },
      },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()

    expect(body.summary.cost).toBeCloseTo(9, 2)
    expect(body.summary.profit).toBeCloseTo(21, 2) // 30 - 9
    expect(body.summary.hasMissingCost).toBe(false)
  })

  it("falls back to costSnapshot * quantity for legacy orders without costTotalSnapshot", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o_legacy",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 3,
        amount: "30.00" as any,
        costSnapshot: "3.00" as any, // legacy per-unit
        costTotalSnapshot: null,
        product: { name: "A" },
      },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()

    expect(body.summary.cost).toBeCloseTo(9, 2) // 3 × 3
    expect(body.summary.profit).toBeCloseTo(21, 2)
    expect(body.summary.hasMissingCost).toBe(false)
  })

  it("flags hasMissingCost only when both snapshots are null", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o_missing",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 1,
        amount: "10.00" as any,
        costSnapshot: null,
        costTotalSnapshot: null,
        product: { name: "A" },
      },
      {
        id: "o_zero",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 1,
        amount: "10.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "0" as any, // AUTO_FETCH: cost explicitly 0, not missing
        product: { name: "A" },
      },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()

    expect(body.summary.hasMissingCost).toBe(true)
  })

  it("returns a continuous daily series bucketed by HKT paidAt", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    // 2 orders on 3/17 HKT, 1 order on 3/19 HKT; 3/18 has no activity
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 2,
        amount: "100.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "30.00" as any,
        paidAt: new Date("2025-03-17T04:00:00Z"), // 3/17 12:00 HKT
        product: { name: "A" },
      },
      {
        id: "o2",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 1,
        amount: "50.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "10.00" as any,
        paidAt: new Date("2025-03-17T18:00:00Z"), // 3/18 02:00 HKT
        product: { name: "A" },
      },
      {
        id: "o3",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 3,
        amount: "200.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "60.00" as any,
        paidAt: new Date("2025-03-19T05:00:00Z"), // 3/19 13:00 HKT
        product: { name: "A" },
      },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "10.00" as any } },
    ] as any)
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue(NO_BONUS)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-19" }))
    const body = await res.json()

    expect(body.series).toHaveLength(3)
    expect(body.series[0]).toMatchObject({ date: "2025-03-17", revenue: 100, cost: 30, quantity: 2, orderCount: 1 })
    expect(body.series[0].profit).toBeCloseTo(60, 2) // 100 - 30 - 10
    expect(body.series[1]).toMatchObject({ date: "2025-03-18", revenue: 50, cost: 10, quantity: 1, orderCount: 1 })
    expect(body.series[1].profit).toBeCloseTo(40, 2) // 50 - 10
    expect(body.series[2]).toMatchObject({ date: "2025-03-19", revenue: 200, cost: 60, quantity: 3, orderCount: 1 })
    expect(body.series[2].profit).toBeCloseTo(140, 2) // 200 - 60
  })

  it("excludes milestone bonuses from both daily series and summary profit", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "o1",
        productId: "p1",
        productNameSnapshot: "A",
        quantity: 1,
        amount: "100.00" as any,
        costSnapshot: null,
        costTotalSnapshot: "20.00" as any,
        paidAt: new Date("2025-03-17T04:00:00Z"),
        product: { name: "A" },
      },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])
    prismaMock.invitationMilestoneBonus.findMany.mockResolvedValue([
      { amount: "25.00" as any, createdAt: new Date("2025-03-18T04:00:00Z") },
    ] as any)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-18" }))
    const body = await res.json()

    // Milestone bonuses are cumulative incentives — never blended into operational
    // profit (any window). They're reported via summary.milestoneBonus only.
    expect(body.series).toHaveLength(2)
    expect(body.series[0].profit).toBeCloseTo(80, 2) // 100 - 20
    expect(body.series[1]).toMatchObject({ date: "2025-03-18", revenue: 0, cost: 0, quantity: 0, orderCount: 0 })
    expect(body.series[1].profit).toBeCloseTo(0, 2)
    // Summary surfaces the bonus separately, does NOT deduct from profit
    expect(body.summary.milestoneBonus).toBeCloseTo(25, 2)
    expect(body.summary.profit).toBeCloseTo(80, 2) // 100 - 20 (no milestone deduction)
  })
})
