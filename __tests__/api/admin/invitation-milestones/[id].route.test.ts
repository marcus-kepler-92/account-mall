import { PATCH, DELETE } from "@/app/api/admin/invitation-milestones/[id]/route"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/domains/distributors", () => {
  const actual = jest.requireActual("@/lib/domains/distributors")
  return {
    updateMilestoneSchema: actual.updateMilestoneSchema,
    updateInvitationMilestone: jest.fn(),
    deleteInvitationMilestone: jest.fn(),
    InvitationMilestoneNotFoundError: actual.InvitationMilestoneNotFoundError,
    InvitationMilestoneHasBonusesError: actual.InvitationMilestoneHasBonusesError,
  }
})

import {
  updateInvitationMilestone,
  deleteInvitationMilestone,
  InvitationMilestoneNotFoundError,
  InvitationMilestoneHasBonusesError,
} from "@/lib/domains/distributors"

const mockSession = { user: { id: "admin-1" } }
const mockMilestone = {
  id: "m1",
  thresholdAmount: 2000,
  bonusAmount: 100,
  sortOrder: 0,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-02"),
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
})

describe("PATCH /api/admin/invitation-milestones/[id]", () => {
  function makeReq(body: unknown) {
    return new NextRequest("http://localhost/api/admin/invitation-milestones/m1", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeReq({ bonusAmount: 100 }), makeContext("m1"))
    expect(res.status).toBe(401)
  })

  it("returns 400 on invalid body", async () => {
    const res = await PATCH(makeReq({ bonusAmount: -5 }), makeContext("m1"))
    expect(res.status).toBe(400)
  })

  it("returns 404 when milestone not found", async () => {
    ;(updateInvitationMilestone as jest.Mock).mockRejectedValue(
      new InvitationMilestoneNotFoundError("m1"),
    )
    const res = await PATCH(makeReq({ bonusAmount: 100 }), makeContext("m1"))
    expect(res.status).toBe(404)
  })

  it("updates milestone and returns 200", async () => {
    ;(updateInvitationMilestone as jest.Mock).mockResolvedValue(mockMilestone)
    const res = await PATCH(makeReq({ bonusAmount: 100 }), makeContext("m1"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bonusAmount).toBe(100)
    expect(updateInvitationMilestone).toHaveBeenCalledWith("m1", { bonusAmount: 100 })
  })
})

describe("DELETE /api/admin/invitation-milestones/[id]", () => {
  function makeReq() {
    return new NextRequest("http://localhost/api/admin/invitation-milestones/m1", {
      method: "DELETE",
    })
  }

  it("returns 401 when not authenticated", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await DELETE(makeReq(), makeContext("m1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when milestone not found", async () => {
    ;(deleteInvitationMilestone as jest.Mock).mockRejectedValue(
      new InvitationMilestoneNotFoundError("m1"),
    )
    const res = await DELETE(makeReq(), makeContext("m1"))
    expect(res.status).toBe(404)
  })

  it("returns 400 when milestone has bonuses", async () => {
    ;(deleteInvitationMilestone as jest.Mock).mockRejectedValue(
      new InvitationMilestoneHasBonusesError(),
    )
    const res = await DELETE(makeReq(), makeContext("m1"))
    expect(res.status).toBe(400)
  })

  it("deletes milestone and returns 204", async () => {
    ;(deleteInvitationMilestone as jest.Mock).mockResolvedValue(undefined)
    const res = await DELETE(makeReq(), makeContext("m1"))
    expect(res.status).toBe(204)
  })
})
