/**
 * PATCH /api/admin/orders/[orderId]/distributor
 * Coverage: auth, order lookup, distributor validation, set/clear distributorId
 */
import { NextRequest } from "next/server"
import { PATCH } from "@/app/api/admin/orders/[orderId]/distributor/route"
import { prismaMock } from "../../../../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

const getAdminSessionMock = getAdminSession as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockOrder = { id: "order-1", distributorId: null }
const mockDistributor = { id: "dist-1", role: "DISTRIBUTOR" }

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/orders/[orderId]/distributor", () => {
    beforeEach(() => {
        getAdminSessionMock.mockResolvedValue({ user: { id: "admin-1" } })
        prismaMock.order.findUnique.mockResolvedValue(mockOrder as never)
        prismaMock.user.findUnique.mockResolvedValue(mockDistributor as never)
        prismaMock.order.update.mockResolvedValue({ ...mockOrder, distributorId: "dist-1" } as never)
    })

    it("returns 401 when not admin", async () => {
        getAdminSessionMock.mockResolvedValue(null)
        const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
        expect(res.status).toBe(401)
    })

    it("sets distributorId on order", async () => {
        const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
        expect(res.status).toBe(200)
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: "order-1" },
            data: { distributorId: "dist-1" },
        })
    })

    it("clears distributorId when null", async () => {
        const res = await PATCH(makeRequest({ distributorId: null }), makeContext())
        expect(res.status).toBe(200)
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: "order-1" },
            data: { distributorId: null },
        })
    })

    it("returns 404 when order not found", async () => {
        prismaMock.order.findUnique.mockResolvedValue(null)
        const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
        expect(res.status).toBe(404)
    })

    it("returns 400 when distributorId references non-distributor user", async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: "dist-1", role: "ADMIN" } as never)
        const res = await PATCH(makeRequest({ distributorId: "dist-1" }), makeContext())
        expect(res.status).toBe(400)
    })
})
