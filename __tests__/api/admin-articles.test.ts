import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/admin/articles/route"
import { PATCH, DELETE } from "@/app/api/admin/articles/[id]/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/revalidate-storefront", () => ({
    __esModule: true,
    revalidateArticles: jest.fn(),
}))

const getAdminSession = require("@/lib/auth-guard").getAdminSession as jest.Mock
const revalidateArticles = require("@/lib/revalidate-storefront").revalidateArticles as jest.Mock

const adminSession = { user: { id: "admin_1" } }

function createRequest(body?: unknown): NextRequest {
    const req = { url: "http://localhost/api/admin/articles" } as unknown as NextRequest
    if (body !== undefined) {
        (req as unknown as { json: () => Promise<unknown> }).json = async () => body
    }
    return req
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

const validBody = {
    title: "外区Apple ID怎么选？",
    slug: "which-region-apple-id",
    summary: "  美区、港区、日区对比  ",
    seoTitle: "",
    status: "PUBLISHED",
    productIds: ["p1", "p2", "p1"],
}

describe("admin articles API", () => {
    beforeEach(() => {
        getAdminSession.mockReset()
        revalidateArticles.mockReset()
    })

    it("rejects unauthenticated requests", async () => {
        getAdminSession.mockResolvedValue(null)
        expect((await GET()).status).toBe(401)
        expect((await POST(createRequest(validBody))).status).toBe(401)
        expect(prismaMock.article.create).not.toHaveBeenCalled()
    })

    it("rejects a slug that is not lowercase ASCII words", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        const res = await POST(createRequest({ ...validBody, slug: "美区 Apple ID" }))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.code).toBe("VALIDATION_FAILED")
        expect(data.details.fieldErrors.slug).toBeDefined()
        expect(prismaMock.article.create).not.toHaveBeenCalled()
    })

    it("returns a field error when the slug is already taken", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValue({ id: "other" } as never)
        const res = await POST(createRequest(validBody))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.details.fieldErrors.slug[0]).toMatch(/已被其他文章使用/)
        expect(prismaMock.article.create).not.toHaveBeenCalled()
    })

    it("returns a field error when a related product does not exist", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValue(null)
        prismaMock.product.count.mockResolvedValue(1)
        const res = await POST(createRequest(validBody))
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.details.fieldErrors.productIds).toBeDefined()
    })

    it("creates a published article, normalising blanks and de-duplicating products", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValue(null)
        prismaMock.product.count.mockResolvedValue(2)
        prismaMock.article.create.mockResolvedValue({ id: "a1" } as never)

        const res = await POST(createRequest(validBody))
        expect(res.status).toBe(201)

        const { data } = prismaMock.article.create.mock.calls[0][0]
        expect(data.slug).toBe("which-region-apple-id")
        expect(data.summary).toBe("美区、港区、日区对比")
        expect(data.seoTitle).toBeNull()
        expect(data.status).toBe("PUBLISHED")
        expect(data.publishedAt).toBeInstanceOf(Date)
        expect(data.products).toEqual({ connect: [{ id: "p1" }, { id: "p2" }] })
        expect(revalidateArticles).toHaveBeenCalled()
    })

    it("keeps publishedAt when editing an already published article", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique
            .mockResolvedValueOnce({ id: "a1", status: "PUBLISHED" } as never) // existing
        prismaMock.article.update.mockResolvedValue({ id: "a1" } as never)

        const res = await PATCH(createRequest({ title: "新标题", status: "PUBLISHED" }), ctx("a1"))
        expect(res.status).toBe(200)
        const { data } = prismaMock.article.update.mock.calls[0][0]
        expect(data.title).toBe("新标题")
        expect(data).not.toHaveProperty("publishedAt")
        expect(data).not.toHaveProperty("products")
    })

    it("allows saving an article with its own slug and replaces related products", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique
            .mockResolvedValueOnce({ id: "a1", status: "DRAFT" } as never) // existing
            .mockResolvedValueOnce({ id: "a1" } as never) // slug owner is itself
        prismaMock.product.count.mockResolvedValue(1)
        prismaMock.article.update.mockResolvedValue({ id: "a1" } as never)

        const res = await PATCH(
            createRequest({ slug: "which-region-apple-id", status: "PUBLISHED", productIds: ["p9"] }),
            ctx("a1"),
        )
        expect(res.status).toBe(200)
        const { data } = prismaMock.article.update.mock.calls[0][0]
        expect(data.publishedAt).toBeInstanceOf(Date)
        expect(data.products).toEqual({ set: [{ id: "p9" }] })
    })

    it("clears publishedAt when unpublishing", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValueOnce({ id: "a1", status: "PUBLISHED" } as never)
        prismaMock.article.update.mockResolvedValue({ id: "a1" } as never)

        await PATCH(createRequest({ status: "DRAFT" }), ctx("a1"))
        expect(prismaMock.article.update.mock.calls[0][0].data.publishedAt).toBeNull()
    })

    it("returns 404 when deleting a missing article", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValue(null)
        const res = await DELETE(createRequest(), ctx("missing"))
        expect(res.status).toBe(404)
        expect(prismaMock.article.delete).not.toHaveBeenCalled()
    })

    it("deletes an article and revalidates the storefront cache", async () => {
        getAdminSession.mockResolvedValue(adminSession)
        prismaMock.article.findUnique.mockResolvedValue({ id: "a1" } as never)
        prismaMock.article.delete.mockResolvedValue({ id: "a1" } as never)
        const res = await DELETE(createRequest(), ctx("a1"))
        expect(res.status).toBe(200)
        expect(revalidateArticles).toHaveBeenCalled()
    })
})
