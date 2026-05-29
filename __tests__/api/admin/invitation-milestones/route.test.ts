import { GET, POST } from "@/app/api/admin/invitation-milestones/route"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/distributors", () => ({
  listInvitationMilestones: jest.fn(),
  createInvitationMilestone: jest.fn(),
  createMilestoneSchema: jest.requireActual("@/lib/domains/distributors").createMilestoneSchema,
}))

import { listInvitationMilestones, createInvitationMilestone } from "@/lib/domains/distributors"

const mockSession = { user: { id: "admin-1" } }
const mockMilestone = {
  id: "m1",
  thresholdAmount: 1000,
  bonusAmount: 50,
  sortOrder: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

describe("GET /api/admin/invitation-milestones", () => {
  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns list of milestones", async () => {
    ;(listInvitationMilestones as jest.Mock).mockResolvedValue([mockMilestone])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("m1")
  })
})

describe("POST /api/admin/invitation-milestones", () => {
  function makeReq(body: unknown) {
    return new NextRequest("http://localhost/api/admin/invitation-milestones", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await POST(makeReq({ thresholdAmount: 1000, bonusAmount: 50 }))
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid body", async () => {
    const res = await POST(makeReq({ thresholdAmount: -1 }))
    expect(res.status).toBe(400)
  })

  it("returns 400 on missing fields", async () => {
    const res = await POST(makeReq({ thresholdAmount: 1000 }))
    expect(res.status).toBe(400)
  })

  it("creates milestone and returns 201", async () => {
    ;(createInvitationMilestone as jest.Mock).mockResolvedValue(mockMilestone)
    const res = await POST(makeReq({ thresholdAmount: 1000, bonusAmount: 50, thresholdCount: 3 }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("m1")
    expect(createInvitationMilestone).toHaveBeenCalledWith({ thresholdAmount: 1000, bonusAmount: 50, thresholdCount: 3 })
  })
})
