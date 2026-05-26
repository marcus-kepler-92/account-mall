/**
 * POST /api/admin/orders/[orderId]/take
 *
 * - 401 if no admin session
 * - 409 if order not in AWAITING_FULFILLMENT (illegal transition)
 * - 200 transitions order AWAITING_FULFILLMENT -> PROCESSING
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/admin/orders/[orderId]/take/route"
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

const PRODUCT_ID = "cmanualproduct000000000001"
const ORDER_ID = "cmanualorder0000000000001"

function makeRequest(): NextRequest {
    return {} as unknown as NextRequest
}

function makeCtx() {
    return { params: Promise.resolve({ orderId: ORDER_ID }) }
}

function makeManualOrder(status: "PENDING" | "AWAITING_FULFILLMENT" | "PROCESSING" | "COMPLETED" | "CLOSED") {
    return {
        id: ORDER_ID,
        orderNo: "FAK-MANUAL-1",
        status,
        productId: PRODUCT_ID,
        product: { productType: "MANUAL" },
    }
}

describe("POST /api/admin/orders/[orderId]/take", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        ;(prismaMock.order.findUnique as jest.Mock).mockReset()
        ;(prismaMock.order.update as jest.Mock).mockReset()
    })

    it("returns 401 when no admin session", async () => {
        adminSessionMock.mockResolvedValue(null)

        const res = await POST(makeRequest(), makeCtx())

        expect(res.status).toBe(401)
        expect(prismaMock.order.findUnique).not.toHaveBeenCalled()
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("returns 409 when order is not in AWAITING_FULFILLMENT", async () => {
        adminSessionMock.mockResolvedValue({ id: "admin_1", user: { id: "admin_1", email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("PROCESSING") as any)

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(409)
        expect(body.error).toMatch(/Illegal order transition/i)
        expect(prismaMock.order.update).not.toHaveBeenCalled()
    })

    it("transitions order AWAITING_FULFILLMENT -> PROCESSING and returns 200", async () => {
        adminSessionMock.mockResolvedValue({ id: "admin_1", user: { id: "admin_1", email: "admin@test.com" } })
        ;(prismaMock.order.findUnique as jest.Mock).mockResolvedValueOnce(makeManualOrder("AWAITING_FULFILLMENT") as any)
        ;(prismaMock.order.update as jest.Mock).mockResolvedValueOnce({})

        const res = await POST(makeRequest(), makeCtx())
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body).toEqual({ ok: true })
        expect(prismaMock.order.update).toHaveBeenCalledWith({
            where: { id: ORDER_ID },
            data: { status: "PROCESSING" },
        })
    })
})
