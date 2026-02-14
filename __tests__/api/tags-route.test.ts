import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/tags/route"
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

function createJsonRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
    } as unknown as NextRequest
}

describe("GET /api/tags", () => {
    it("returns all tags with product counts", async () => {
        const tags = [
            {
                id: "tag_1",
                name: "Game",
                slug: "game",
                _count: { products: 3 },
            },
        ]
        prismaMock.tag.findMany.mockResolvedValueOnce(tags)

        const res = await GET()
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual(tags)
        expect(prismaMock.tag.findMany).toHaveBeenCalledWith({
            include: {
                _count: { select: { products: true } },
            },
            orderBy: { name: "asc" },
        })
    })
})

describe("POST /api/tags", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await POST(createJsonRequest({ name: "New Tag" }))
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 400 when body is invalid JSON", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        const req = {
            json: async () => {
                throw new Error("bad json")
            },
        } as unknown as NextRequest

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data).toEqual({ error: "Invalid JSON body" })
    })

    it("returns 400 when validation fails (missing name)", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(createJsonRequest({}))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 409 when tag name already exists", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findFirst.mockResolvedValueOnce({
            id: "existing",
            name: "Game",
            slug: "game",
        })

        const res = await POST(createJsonRequest({ name: "Game" }))
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data).toEqual({
            error: "A tag with this name already exists",
        })
    })

    it("creates tag and returns 201", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findFirst.mockResolvedValueOnce(null)
        const created = {
            id: "tag_new",
            name: "New Tag",
            slug: "new-tag",
        }
        prismaMock.tag.create.mockResolvedValueOnce(created)

        const res = await POST(createJsonRequest({ name: "New Tag" }))
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({
            id: "tag_new",
            name: "New Tag",
            slug: "new-tag",
        })
        expect(prismaMock.tag.create).toHaveBeenCalledWith({
            data: { name: "New Tag", slug: "new-tag" },
        })
    })
})
