import { type NextRequest } from "next/server"
import { DELETE } from "@/app/api/tags/[tagId]/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return {
        __esModule: true,
        prisma: prismaMock,
    }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

type RouteContext = { params: Promise<{ tagId: string }> }

function createContext(tagId: string): RouteContext {
    return { params: Promise.resolve({ tagId }) }
}

describe("DELETE /api/tags/[tagId]", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await DELETE(
            {} as NextRequest,
            createContext("tag_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 404 when tag does not exist", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findUnique.mockResolvedValueOnce(null)

        const res = await DELETE(
            {} as NextRequest,
            createContext("nonexistent") as any
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Tag not found" })
    })

    it("deletes tag and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findUnique.mockResolvedValueOnce({
            id: "tag_1",
            name: "Game",
            slug: "game",
        })
        prismaMock.tag.delete.mockResolvedValueOnce({} as any)

        const res = await DELETE(
            {} as NextRequest,
            createContext("tag_1") as any
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ message: "Tag deleted" })
        expect(prismaMock.tag.delete).toHaveBeenCalledWith({
            where: { id: "tag_1" },
        })
    })
})
