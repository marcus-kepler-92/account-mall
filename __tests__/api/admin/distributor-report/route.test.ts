jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/distributors", () => ({
  getDistributorReport: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"
import * as distributorsModule from "@/lib/domains/distributors"
import { GET } from "@/app/api/admin/distributor-report/route"

const mockSession = { user: { id: "u1", email: "admin@test.com" } }

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/admin/distributor-report")
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return new Request(url)
}

beforeEach(() => {
  jest.clearAllMocks()
})

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
    ;(distributorsModule.getDistributorReport as jest.Mock).mockResolvedValue({
      summary: {
        pendingCommissionAmount: 0,
        settledCommission: 0,
        distributorCount: 5,
        newDistributorCount: 0,
      },
      leaderboard: [],
      newDistributors: [],
    })

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.distributorCount).toBe(5)
    expect(body.leaderboard).toEqual([])
  })

  it("returns leaderboard sorted by revenue with pending commission", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
    ;(distributorsModule.getDistributorReport as jest.Mock).mockResolvedValue({
      summary: {
        pendingCommissionAmount: 300,
        settledCommission: 150,
        distributorCount: 3,
        newDistributorCount: 0,
      },
      leaderboard: [
        {
          distributorId: "d1",
          name: "Alice",
          email: "alice@test.com",
          revenue: 2000,
          orderCount: 10,
          pendingCommission: 60,
        },
        {
          distributorId: "d2",
          name: null,
          email: "bob@test.com",
          revenue: 800,
          orderCount: 4,
          pendingCommission: 0,
        },
      ],
      newDistributors: [],
    })

    const res = await GET(makeRequest({ from: "2026-03-01", to: "2026-03-17" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.pendingCommissionAmount).toBe(300)
    expect(body.summary.settledCommission).toBe(150)
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
