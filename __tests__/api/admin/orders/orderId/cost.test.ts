import { NextRequest } from "next/server"
import { PATCH } from "@/app/api/admin/orders/[orderId]/cost/route"
import { prismaMock } from "../../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

const getAdminSessionMock = getAdminSession as jest.Mock
const mockSession = { user: { id: "admin-1" } }

function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/admin/orders/order-1/cost", {
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
    getAdminSessionMock.mockResolvedValue(mockSession)
    ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValue({
        status: "COMPLETED",
    })
    ;(prismaMock.order.update as jest.Mock).mockResolvedValue({ id: "order-1" })
})

describe("PATCH /api/admin/orders/[orderId]/cost", () => {
    it("returns 401 when not admin", async () => {
        getAdminSessionMock.mockResolvedValue(null)
        const res = await PATCH(makeRequest({ costTotal: 10 }), makeContext())
        expect(res.status).toBe(401)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("returns 400 for negative cost", async () => {
        const res = await PATCH(makeRequest({ costTotal: -5 }), makeContext())
        expect(res.status).toBe(400)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("returns 400 for non-numeric cost", async () => {
        const res = await PATCH(makeRequest({ costTotal: "abc" }), makeContext())
        expect(res.status).toBe(400)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("returns 404 when order not found", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValue(null)
        const res = await PATCH(makeRequest({ costTotal: 10 }), makeContext())
        expect(res.status).toBe(404)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("returns 400 when order is not COMPLETED", async () => {
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValue({
            status: "PENDING",
        })
        const res = await PATCH(makeRequest({ costTotal: 10 }), makeContext())
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/已完成/)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("updates costTotalSnapshot for a COMPLETED order", async () => {
        const res = await PATCH(makeRequest({ costTotal: 12.5 }), makeContext())
        expect(res.status).toBe(200)
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: "order-1" },
            data: { costTotalSnapshot: 12.5 },
        })
    })

    it("returns 400 for a string cost (no coercion)", async () => {
        const res = await PATCH(makeRequest({ costTotal: "8.25" }), makeContext())
        expect(res.status).toBe(400)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("allows setting cost to zero", async () => {
        const res = await PATCH(makeRequest({ costTotal: 0 }), makeContext())
        expect(res.status).toBe(200)
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: "order-1" },
            data: { costTotalSnapshot: 0 },
        })
    })
})
