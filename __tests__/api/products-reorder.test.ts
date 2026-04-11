import { type NextRequest } from "next/server"
import { PATCH } from "@/app/api/admin/products/reorder/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

function createJsonRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

describe("PATCH /api/admin/products/reorder", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
        prismaMock.$transaction.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await PATCH(createJsonRequest({ ids: ["p1", "p2"] }))
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("returns 400 when ids is missing", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await PATCH(createJsonRequest({}))
        const data = await res.json()

        expect(res.status).toBe(400)
    })

    it("returns 400 when ids is not an array", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await PATCH(createJsonRequest({ ids: "p1" }))
        const data = await res.json()

        expect(res.status).toBe(400)
    })

    it("batch-updates sortOrder and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.update.mockResolvedValue({} as any)
        prismaMock.$transaction.mockResolvedValueOnce(undefined)

        const res = await PATCH(createJsonRequest({ ids: ["p3", "p1", "p2"] }))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ ok: true })
        expect(prismaMock.$transaction).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.anything(),
                expect.anything(),
                expect.anything(),
            ])
        )
    })
})
