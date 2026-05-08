import { GET } from "@/app/api/distributor/milestone-bonuses/route"
import { getDistributorSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getDistributorSession: jest.fn() }))
jest.mock("@/lib/domains/distributors", () => ({
  listDistributorMilestoneBonuses: jest.fn(),
}))

import { listDistributorMilestoneBonuses } from "@/lib/domains/distributors"

const mockSession = { user: { id: "dist-1" } }
const mockBonus = {
  id: "b1",
  inviteeId: "inv-1",
  inviteeName: "张三",
  thresholdSnapshot: 1000,
  amount: 50,
  createdAt: new Date("2025-03-01"),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getDistributorSession as jest.Mock).mockResolvedValue(mockSession)
})

describe("GET /api/distributor/milestone-bonuses", () => {
  function makeReq(query = "") {
    return new NextRequest(`http://localhost/api/distributor/milestone-bonuses${query}`)
  }

  it("returns 401 when not authenticated", async () => {
    ;(getDistributorSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it("returns paginated bonuses with defaults", async () => {
    ;(listDistributorMilestoneBonuses as jest.Mock).mockResolvedValue({
      data: [mockBonus],
      total: 1,
    })
    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(listDistributorMilestoneBonuses).toHaveBeenCalledWith("dist-1", 1, 20)
  })

  it("respects page and pageSize query params", async () => {
    ;(listDistributorMilestoneBonuses as jest.Mock).mockResolvedValue({ data: [], total: 0 })
    await GET(makeReq("?page=3&pageSize=10"))
    expect(listDistributorMilestoneBonuses).toHaveBeenCalledWith("dist-1", 3, 10)
  })

  it("clamps pageSize to max 50", async () => {
    ;(listDistributorMilestoneBonuses as jest.Mock).mockResolvedValue({ data: [], total: 0 })
    await GET(makeReq("?pageSize=100"))
    expect(listDistributorMilestoneBonuses).toHaveBeenCalledWith("dist-1", 1, 50)
  })

  it("clamps page to min 1 on invalid input", async () => {
    ;(listDistributorMilestoneBonuses as jest.Mock).mockResolvedValue({ data: [], total: 0 })
    await GET(makeReq("?page=0"))
    expect(listDistributorMilestoneBonuses).toHaveBeenCalledWith("dist-1", 1, 20)
  })
})
