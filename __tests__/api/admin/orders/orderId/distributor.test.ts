import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { prismaMock } from "../../../../../__mocks__/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import * as commissionsModule from "@/lib/calculate-order-commission"
import { NextRequest } from "next/server"

jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))
jest.mock("@/lib/calculate-order-commission", () => ({
  createOrderCommissions: jest.fn(),
  // Use the real toNumber — it's pure and has no side-effects
  toNumber: jest.requireActual("@/lib/calculate-order-commission").toNumber,
}))
jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../../../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

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
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
  prismaMock.order.findUnique.mockResolvedValue(mockCompletedOrder)
  prismaMock.commission.findMany.mockResolvedValue([])
  prismaMock.user.findUnique.mockResolvedValue({ id: "dist-1", role: "DISTRIBUTOR" })
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn(prismaMock)
  )
  prismaMock.commission.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.order.update.mockResolvedValue({ ...mockCompletedOrder, distributorId: "dist-1" })
  ;(commissionsModule.createOrderCommissions as jest.Mock).mockResolvedValue(undefined)
})

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
  it("returns 401 when not admin", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(401)
  })

  it("returns 404 when order not found", async () => {
    prismaMock.order.findUnique.mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(404)
  })

  it("returns 400 when order is not COMPLETED", async () => {
    prismaMock.order.findUnique.mockResolvedValue({ ...mockCompletedOrder, status: "PENDING" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/COMPLETED/)
  })

  it("returns 400 when distributorId references non-DISTRIBUTOR user", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "dist-1", role: "ADMIN" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 409 when affected distributor has PENDING withdrawal", async () => {
    prismaMock.commission.findMany.mockResolvedValue([
      { id: "c-1", distributorId: "old-dist", amount: "50", status: "SETTLED" },
    ])
    prismaMock.withdrawal.count.mockResolvedValue(1)
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("returns 409 when cancelling commission would make balance negative", async () => {
    prismaMock.commission.findMany.mockResolvedValue([
      { id: "c-1", distributorId: "old-dist", amount: "100", status: "SETTLED" },
    ])
    prismaMock.withdrawal.count.mockResolvedValue(0)
    // settled=100, commission_to_cancel=100, paid=80 → 100-100-80 = -80 < 0
    prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: "100" } })
    prismaMock.withdrawal.aggregate.mockResolvedValue({ _sum: { amount: "80" } })  // PAID
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/提现/)
  })

  it("cancels existing commissions and assigns new distributor in transaction", async () => {
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
    expect(res.status).toBe(200)
    expect(prismaMock.commission.updateMany).toHaveBeenCalledWith({
      where: { orderId: "order-1", status: { in: ["SETTLED", "PENDING"] } },
      data: { status: "CANCELLED" },
    })
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: "dist-1" },
    })
    expect(commissionsModule.createOrderCommissions).toHaveBeenCalled()
  })

  it("clears distributor and cancels commissions when distributorId is null", async () => {
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(200)
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: null },
    })
    expect(commissionsModule.createOrderCommissions).not.toHaveBeenCalled()
  })

  it("returns 400 for invalid body schema (non-string distributorId)", async () => {
    const res = await PATCH(makeRequest({ distributorId: 123 }), makeContext())
    expect(res.status).toBe(400)
  })

  it("returns 500 when transaction throws", async () => {
    prismaMock.$transaction.mockRejectedValue(new Error("DB error"))
    const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
    expect(res.status).toBe(500)
  })
})
