import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/admin/guides/route"
import { GET as GetOne, PATCH, DELETE } from "@/app/api/admin/guides/[id]/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock

const adminSession = { user: { id: "admin_1" } }

function createRequest(url: string, body?: unknown): NextRequest {
    const req = { url } as unknown as NextRequest
    if (body !== undefined) {
        (req as unknown as { json: () => Promise<unknown> }).json = async () => body
    }
    return req
}

function createIdParams(id: string) {
    return Promise.resolve({ id })
}

describe("POST /api/admin/guides", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await POST(createRequest("http://localhost/api/admin/guides", { title: "Guide 1" }))
        expect(res.status).toBe(401)
        expect(prismaMock.distributorGuide.create).not.toHaveBeenCalled()
    })

    it("returns 400 when title is missing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const res = await POST(createRequest("http://localhost/api/admin/guides", { title: "" }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.code).toBe("VALIDATION_FAILED")
        expect(prismaMock.distributorGuide.create).not.toHaveBeenCalled()
    })

    it("returns 400 when tagId is invalid (tag not found)", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.tag.findUnique.mockResolvedValue(null)
        const res = await POST(
            createRequest("http://localhost/api/admin/guides", {
                title: "Guide 1",
                tagId: "nonexistent",
            })
        )
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/类目不存在/)
        expect(prismaMock.distributorGuide.create).not.toHaveBeenCalled()
    })

    it("returns 201 and creates guide when valid", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.distributorGuide.create.mockResolvedValue({
            id: "guide_1",
            title: "Guide 1",
            content: "## Hello",
            tagId: null,
            sortOrder: 0,
            status: "DRAFT",
            publishedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            tag: null,
        })
        const res = await POST(
            createRequest("http://localhost/api/admin/guides", {
                title: "Guide 1",
                content: "## Hello",
            })
        )
        expect(res.status).toBe(201)
        const data = await res.json()
        expect(data.id).toBe("guide_1")
        expect(data.title).toBe("Guide 1")
        expect(prismaMock.distributorGuide.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    title: "Guide 1",
                    content: "## Hello",
                    status: "DRAFT",
                    sortOrder: 0,
                    tagId: null,
                }),
                include: { tag: true },
            })
        )
    })

    it("returns 201 with publishedAt when status is PUBLISHED", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const now = new Date()
        prismaMock.distributorGuide.create.mockResolvedValue({
            id: "guide_1",
            title: "Guide 1",
            content: null,
            tagId: null,
            sortOrder: 0,
            status: "PUBLISHED",
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
            tag: null,
        })
        const res = await POST(
            createRequest("http://localhost/api/admin/guides", {
                title: "Guide 1",
                status: "PUBLISHED",
            })
        )
        expect(res.status).toBe(201)
        expect(prismaMock.distributorGuide.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: "PUBLISHED",
                    publishedAt: expect.any(Date),
                }),
                include: { tag: true },
            })
        )
    })
})

describe("GET /api/admin/guides", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await GET()
        expect(res.status).toBe(401)
        expect(prismaMock.distributorGuide.findMany).not.toHaveBeenCalled()
    })

    it("returns all guides with tag when authenticated", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const guides = [
            {
                id: "g1",
                title: "G1",
                content: "C1",
                tagId: "tag_1",
                sortOrder: 0,
                status: "PUBLISHED",
                publishedAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                tag: { id: "tag_1", name: "Tag1", slug: "tag1" },
            },
        ]
        prismaMock.distributorGuide.findMany.mockResolvedValue(guides)
        const res = await GET()
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toHaveLength(1)
        expect(data[0].title).toBe("G1")
        expect(data[0].tag).toMatchObject({ name: "Tag1" })
        expect(prismaMock.distributorGuide.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: expect.any(Array),
                include: { tag: true },
            })
        )
    })
})

describe("GET /api/admin/guides/[id]", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await GetOne(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(401)
    })

    it("returns 404 when guide not found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.distributorGuide.findUnique.mockResolvedValue(null)
        const res = await GetOne(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(404)
        const data = await res.json()
        expect(data.error).toMatch(/not found|Guide/i)
    })

    it("returns 200 with guide when found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const guide = {
            id: "g1",
            title: "G1",
            content: "C1",
            tagId: null,
            sortOrder: 0,
            status: "DRAFT",
            publishedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            tag: null,
        }
        prismaMock.distributorGuide.findUnique.mockResolvedValue(guide)
        const res = await GetOne(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.id).toBe("g1")
        expect(data.title).toBe("G1")
    })
})

describe("PATCH /api/admin/guides/[id]", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await PATCH(
            createRequest("http://localhost/api/admin/guides/g1", { title: "Updated" }),
            { params: createIdParams("g1") }
        )
        expect(res.status).toBe(401)
    })

    it("returns 404 when guide not found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.distributorGuide.findUnique.mockResolvedValue(null)
        const res = await PATCH(
            createRequest("http://localhost/api/admin/guides/g1", { title: "Updated" }),
            { params: createIdParams("g1") }
        )
        expect(res.status).toBe(404)
        expect(prismaMock.distributorGuide.update).not.toHaveBeenCalled()
    })

    it("returns 200 and updates guide when found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const existing = {
            id: "g1",
            title: "G1",
            content: "C1",
            tagId: null,
            sortOrder: 0,
            status: "DRAFT",
            publishedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        prismaMock.distributorGuide.findUnique.mockResolvedValue(existing)
        prismaMock.distributorGuide.update.mockResolvedValue({
            ...existing,
            title: "Updated",
            tag: null,
        })
        const res = await PATCH(
            createRequest("http://localhost/api/admin/guides/g1", { title: "Updated" }),
            { params: createIdParams("g1") }
        )
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.title).toBe("Updated")
        expect(prismaMock.distributorGuide.update).toHaveBeenCalledWith({
            where: { id: "g1" },
            data: expect.objectContaining({ title: "Updated" }),
            include: { tag: true },
        })
    })

    it("sets publishedAt when status changes to PUBLISHED", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const existing = {
            id: "g1",
            title: "G1",
            content: "C1",
            tagId: null,
            sortOrder: 0,
            status: "DRAFT",
            publishedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        }
        prismaMock.distributorGuide.findUnique.mockResolvedValue(existing)
        prismaMock.distributorGuide.update.mockResolvedValue({
            ...existing,
            status: "PUBLISHED",
            publishedAt: new Date(),
            tag: null,
        })
        await PATCH(
            createRequest("http://localhost/api/admin/guides/g1", { status: "PUBLISHED" }),
            { params: createIdParams("g1") }
        )
        expect(prismaMock.distributorGuide.update).toHaveBeenCalledWith({
            where: { id: "g1" },
            data: expect.objectContaining({
                status: "PUBLISHED",
                publishedAt: expect.any(Date),
            }),
            include: { tag: true },
        })
    })
})

describe("DELETE /api/admin/guides/[id]", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        getAdminSession.mockResolvedValue(null)
        const res = await DELETE(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(401)
    })

    it("returns 404 when guide not found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.distributorGuide.findUnique.mockResolvedValue(null)
        const res = await DELETE(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(404)
        expect(prismaMock.distributorGuide.delete).not.toHaveBeenCalled()
    })

    it("returns 200 and deletes guide when found", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.distributorGuide.findUnique.mockResolvedValue({
            id: "g1",
            title: "G1",
            content: null,
            tagId: null,
            sortOrder: 0,
            status: "DRAFT",
            publishedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        const res = await DELETE(createRequest("http://localhost/api/admin/guides/g1"), {
            params: createIdParams("g1"),
        })
        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.message).toMatch(/deleted|删除/i)
        expect(prismaMock.distributorGuide.delete).toHaveBeenCalledWith({ where: { id: "g1" } })
    })
})
