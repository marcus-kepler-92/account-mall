import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { NextRequest } from "next/server"

jest.mock("@/lib/prisma", () => ({ prisma: { order: { findUnique: jest.fn(), update: jest.fn() }, user: { findUnique: jest.fn() } } }))
jest.mock("@/lib/auth-guard", () => ({ getAdminSession: jest.fn() }))

const mockSession = { user: { id: "admin-1" } }
const mockOrder = { id: "order-1", distributorId: null }
const mockDistributor = { id: "dist-1", role: "DISTRIBUTOR" }

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/distributor", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getAdminSession as jest.Mock).mockResolvedValue(mockSession)
  ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder)
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDistributor)
  ;(prisma.order.update as jest.Mock).mockResolvedValue({ ...mockOrder, distributorId: "dist-1" })
})

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
  it("returns 401 when not admin", async () => {
    ;(getAdminSession as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(401)
  })

  it("sets distributorId on order", async () => {
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: "dist-1" },
    })
  })

  it("clears distributorId when null", async () => {
    const res = await PATCH(makeRequest({ distributorId: null }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { distributorId: null },
    })
  })

  it("returns 404 when order not found", async () => {
    ;(prisma.order.findUnique as jest.Mock).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 400 when distributorId references non-distributor user", async () => {
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: "dist-1", role: "ADMIN" })
    const res = await PATCH(makeRequest({ distributorId: "dist-1" }), { params: Promise.resolve({ orderId: "order-1" }) })
    expect(res.status).toBe(400)
  })
})
