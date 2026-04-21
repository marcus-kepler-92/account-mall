import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { getSuperAdminSession } from "@/lib/auth-guard"
import * as distributorsModule from "@/lib/domains/distributors"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getSuperAdminSession: jest.fn() }))
jest.mock("@/lib/domains/distributors", () => ({
  reassignDistributorSchema: jest.requireActual("@/lib/domains/distributors").reassignDistributorSchema,
  reassignOrderDistributor: jest.fn(),
  CommissionWithdrawnError: jest.requireActual("@/lib/domains/distributors").CommissionWithdrawnError,
  PendingWithdrawalBlocksReassignError: jest.requireActual("@/lib/domains/distributors").PendingWithdrawalBlocksReassignError,
  CommissionAlreadyPaidOutError: jest.requireActual("@/lib/domains/distributors").CommissionAlreadyPaidOutError,
}))

const mockSession = { user: { id: "admin-1" } }

const mockCompletedOrder = {
  id: "order-1",
  orderNo: "ORD001",
  status: "COMPLETED",
  distributorId: null,
  email: "buyer@example.com",
  amount: "100",
  discountPercentApplied: "0",
  paidAt: new Date("2025-01-01"),
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/distributor", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeContext(orderId = "order-1") {
  return { params: Promise.resolve({ orderId }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getSuperAdminSession as jest.Mock).mockResolvedValue(mockSession)
  ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockResolvedValue(undefined)
})

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
  it("returns 401 when not admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 404 when order not found", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new Error("ORDER_NOT_FOUND"))
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(404)
  })

  it("returns 400 when order is not COMPLETED", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new Error("ORDER_NOT_COMPLETED"))
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/COMPLETED/)
  })

  it("returns 400 when distributorId references non-DISTRIBUTOR user", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new Error("INVALID_DISTRIBUTOR"))
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 400 when distributorId references non-existent user", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new Error("INVALID_DISTRIBUTOR"))
    const res = await PATCH(makeRequest({ distributorId: "ghost-user" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 409 when order has WITHDRAWN commissions", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new distributorsModule.CommissionWithdrawnError("此订单佣金已提现，无法修改分销归属"))
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("returns 409 when affected distributor has PENDING withdrawal", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new distributorsModule.PendingWithdrawalBlocksReassignError("分销员存在待处理提现申请，无法修改分销归属"))
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("returns 409 when cancelling commission would make balance negative", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new distributorsModule.CommissionAlreadyPaidOutError("此订单佣金已被提现消耗，无法修改分销归属"))
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("allows reassigning distributor when checks pass", async () => {
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(200)
    expect(distributorsModule.reassignOrderDistributor).toHaveBeenCalledWith("order-1", "dist-1")
  })

  it("allows clearing distributor when checks pass", async () => {
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(200)
    expect(distributorsModule.reassignOrderDistributor).toHaveBeenCalledWith("order-1", null)
  })

  it("returns 400 for invalid body schema (non-string distributorId)", async () => {
    const res = await PATCH(makeRequest({ distributorId: 123 }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 500 when service throws unknown error", async () => {
    ;(distributorsModule.reassignOrderDistributor as jest.Mock).mockRejectedValue(new Error("DB error"))
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(500)
  })
})
