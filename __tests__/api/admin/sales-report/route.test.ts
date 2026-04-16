import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/sales-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

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
    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary).toEqual({ orderCount: 0, totalQuantity: 0, revenue: 0, profit: 0 })
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
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o2",
        productId: "p1",
        productNameSnapshot: "王者荣耀点券",
        quantity: 1,
        amount: "64.80" as any,
        product: { name: "王者荣耀点券" },
      },
      {
        id: "o3",
        productId: "p2",
        productNameSnapshot: null,
        quantity: 1,
        amount: "38.00" as any,
        product: { name: "网易云会员" },
      },
    ] as any)

    // commissions: only o1 has a settled commission
    prismaMock.commission.groupBy.mockResolvedValue([
      { orderId: "o1", _sum: { amount: "13.00" as any } },
    ] as any)

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.orderCount).toBe(3)
    expect(body.summary.totalQuantity).toBe(4)
    expect(body.summary.revenue).toBeCloseTo(232.4, 2)
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

  it("sorts products by profit descending", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.order.findMany.mockResolvedValue([
      { id: "o1", productId: "p1", productNameSnapshot: "A", quantity: 1, amount: "10.00" as any, product: { name: "A" } },
      { id: "o2", productId: "p2", productNameSnapshot: "B", quantity: 1, amount: "50.00" as any, product: { name: "B" } },
    ] as any)
    prismaMock.commission.groupBy.mockResolvedValue([])

    const res = await GET(makeRequest({ from: "2025-03-17", to: "2025-03-17" }))
    const body = await res.json()
    expect(body.products[0].productId).toBe("p2") // higher profit first
    expect(body.products[1].productId).toBe("p1")
  })
})
