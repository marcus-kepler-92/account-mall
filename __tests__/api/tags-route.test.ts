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

function createUrlRequest(url: string): NextRequest {
    return { url } as unknown as NextRequest
}

function createJsonRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
    } as unknown as NextRequest
}

describe("GET /api/tags", () => {
    it("returns all tags with product counts (no code = only public products)", async () => {
        const tags = [
            {
                id: "tag_1",
                name: "Game",
                slug: "game",
                createdAt: new Date(),
                updatedAt: new Date(),
                products: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
            },
        ]
        prismaMock.tag.findMany.mockResolvedValueOnce(tags)

        const res = await GET(createUrlRequest("http://localhost/api/tags"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toHaveLength(1)
        expect(data[0]).toMatchObject({
            id: "tag_1",
            name: "Game",
            slug: "game",
            _count: { products: 3 },
        })
        expect(prismaMock.tag.findMany).toHaveBeenCalledWith({
            include: {
                products: {
                    where: { status: "ACTIVE" },
                    select: { id: true },
                },
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

        const res = await POST(createJsonRequest({ name: "New Tag", slug: "new-tag" }))
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

    it("returns 400 when name is missing", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(createJsonRequest({ slug: "some-slug" }))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 400 when slug is missing", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(createJsonRequest({ name: "网飞会员" }))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 400 when slug has invalid format", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(createJsonRequest({ name: "Test", slug: "Invalid Slug!" }))
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
        } as any)

        const res = await POST(createJsonRequest({ name: "Game", slug: "game" }))
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data).toEqual({ error: "A tag with this name already exists" })
    })

    it("returns 409 when slug conflicts with existing tag", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findFirst.mockResolvedValueOnce({
            id: "existing",
            name: "Games",
            slug: "game",
        } as any)

        const res = await POST(createJsonRequest({ name: "Game", slug: "game" }))
        const data = await res.json()

        expect(res.status).toBe(409)
    })

    it("creates ASCII-named tag with provided slug", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findFirst.mockResolvedValueOnce(null)
        const created = { id: "tag_new", name: "New Tag", slug: "new-tag" }
        prismaMock.tag.create.mockResolvedValueOnce(created as any)

        const res = await POST(createJsonRequest({ name: "New Tag", slug: "new-tag" }))
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({ id: "tag_new", name: "New Tag", slug: "new-tag" })
        expect(prismaMock.tag.create).toHaveBeenCalledWith({
            data: { name: "New Tag", slug: "new-tag" },
        })
    })

    it("creates Chinese-named tag with manually provided slug", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.tag.findFirst.mockResolvedValueOnce(null)
        const created = { id: "tag_cn", name: "网飞会员", slug: "netflix-vip" }
        prismaMock.tag.create.mockResolvedValueOnce(created as any)

        const res = await POST(createJsonRequest({ name: "网飞会员", slug: "netflix-vip" }))
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({ name: "网飞会员", slug: "netflix-vip" })
        expect(prismaMock.tag.create).toHaveBeenCalledWith({
            data: { name: "网飞会员", slug: "netflix-vip" },
        })
    })
})
