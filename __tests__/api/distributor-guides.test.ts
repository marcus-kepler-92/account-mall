import { type NextRequest } from "next/server"
import { GET } from "@/app/api/distributor/guides/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock

const distributorSession = {
    user: {
        id: "dist_1",
        email: "dist@example.com",
        name: "Distributor",
        distributorCode: "PROMO1",
    },
}

function createRequest(url: string): NextRequest {
    return { url } as unknown as NextRequest
}

describe("GET /api/distributor/guides", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await GET(createRequest("http://localhost/api/distributor/guides"))
        expect(res.status).toBe(401)
        expect(prismaMock.distributorGuide.findMany).not.toHaveBeenCalled()
    })

    it("returns only PUBLISHED guides with tag when session present", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const guides = [
            {
                id: "g1",
                title: "Guide 1",
                content: "Content 1",
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
        const res = await GET(createRequest("http://localhost/api/distributor/guides"))
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data.data).toHaveLength(1)
        expect(data.data[0].title).toBe("Guide 1")
        expect(data.data[0].status).toBe("PUBLISHED")
        expect(data.data[0].tag).toMatchObject({ name: "Tag1" })
        expect(prismaMock.distributorGuide.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "PUBLISHED" },
                include: { tag: true },
            })
        )
    })

    it("filters by tagId when query param present", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.distributorGuide.findMany.mockResolvedValue([])
        await GET(createRequest("http://localhost/api/distributor/guides?tagId=tag_1"))
        expect(prismaMock.distributorGuide.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "PUBLISHED", tagId: "tag_1" },
            })
        )
    })
})
