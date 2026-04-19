import { prismaMock } from "@/__mocks__/prisma"

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

import { getAdminSession } from "@/lib/auth-guard"
import { GET } from "@/app/api/admin/distributor-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/distributor-report")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

const zeroWithdrawalAgg = {
  _count: { id: 0 },
  _sum: { amount: null },
  _avg: null, _min: null, _max: null,
} as any
const zeroCommissionAgg = {
  _sum: { amount: null },
  _count: { id: 0 },
  _avg: null, _min: null, _max: null,
} as any

describe("GET /api/admin/distributor-report", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(401)
  })

  it("returns 400 when from is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ to: "2026-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when to is missing", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-03-01" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from > to", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-03-17", to: "2026-03-01" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when from is not a valid date", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    const res = await GET(makeRequest({ from: "2026-02-30", to: "2026-03-17" }))
    expect(res.status).toBe(400)
  })

  it("returns empty leaderboard when no distributor orders", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.aggregate.mockResolvedValueOnce(zeroWithdrawalAgg)
    prismaMock.commission.aggregate
      .mockResolvedValueOnce(zeroCommissionAgg)   // pendingCommissionAmount
      .mockResolvedValueOnce(zeroCommissionAgg)   // monthlySettledCommission
    prismaMock.user.count.mockResolvedValueOnce(5)
    prismaMock.order.groupBy.mockResolvedValueOnce([])

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.distributorCount).toBe(5)
    expect(body.summary.pendingWithdrawalCount).toBe(0)
    expect(body.leaderboard).toEqual([])
  })

  it("returns leaderboard sorted by revenue with pending commission", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    prismaMock.withdrawal.aggregate.mockResolvedValueOnce({
      _count: { id: 2 },
      _sum: { amount: "500.00" },
      _avg: null, _min: null, _max: null,
    } as any)
    prismaMock.commission.aggregate
      .mockResolvedValueOnce({
        _sum: { amount: "300.00" },
        _count: { id: 0 }, _avg: null, _min: null, _max: null,
      } as any)  // pendingCommissionAmount
      .mockResolvedValueOnce({
        _sum: { amount: "150.00" },
        _count: { id: 0 }, _avg: null, _min: null, _max: null,
      } as any)  // monthlySettledCommission
    prismaMock.user.count.mockResolvedValueOnce(3)
    prismaMock.order.groupBy.mockResolvedValueOnce([
      { distributorId: "d1", _sum: { amount: "2000.00" }, _count: { id: 10 } } as any,
      { distributorId: "d2", _sum: { amount: "800.00" }, _count: { id: 4 } } as any,
    ])
    prismaMock.user.findMany.mockResolvedValueOnce([
      { id: "d1", name: "Alice", email: "alice@test.com" } as any,
      { id: "d2", name: null, email: "bob@test.com" } as any,
    ])
    prismaMock.commission.groupBy.mockResolvedValueOnce([
      { distributorId: "d1", _sum: { amount: "60.00" } } as any,
    ])

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.pendingWithdrawalCount).toBe(2)
    expect(body.summary.pendingWithdrawalAmount).toBe(500)
    expect(body.summary.pendingCommissionAmount).toBe(300)
    expect(body.summary.monthlySettledCommission).toBe(150)
    expect(body.summary.distributorCount).toBe(3)

    expect(body.leaderboard).toHaveLength(2)
    expect(body.leaderboard[0].distributorId).toBe("d1")
    expect(body.leaderboard[0].revenue).toBe(2000)
    expect(body.leaderboard[0].orderCount).toBe(10)
    expect(body.leaderboard[0].pendingCommission).toBe(60)
    expect(body.leaderboard[0].name).toBe("Alice")
    expect(body.leaderboard[1].distributorId).toBe("d2")
    expect(body.leaderboard[1].pendingCommission).toBe(0)
    expect(body.leaderboard[1].name).toBeNull()
  })
})
