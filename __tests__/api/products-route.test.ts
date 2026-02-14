import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/products/route"
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

describe("GET /api/products", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns only ACTIVE products for public request (no admin param)", async () => {
        const products = [
            {
                id: "p1",
                name: "Product 1",
                slug: "product-1",
                status: "ACTIVE",
                price: 100,
                tags: [],
                _count: { cards: 5 },
            },
        ]
        prismaMock.product.findMany.mockResolvedValueOnce(products)
        prismaMock.product.count.mockResolvedValueOnce(1)
        prismaMock.card.count.mockResolvedValueOnce(3)

        const res = await GET(createUrlRequest("http://localhost/api/products"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "ACTIVE" },
            })
        )
        expect(data.data).toHaveLength(1)
        expect(data.data[0].stock).toBe(3)
        expect(data.meta).toMatchObject({ total: 1, page: 1, pageSize: 9 })
    })

    it("returns 401 when admin=true and not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await GET(
            createUrlRequest("http://localhost/api/products?admin=true")
        )
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
        expect(prismaMock.product.findMany).not.toHaveBeenCalled()
    })

    it("returns products with optional status filter when admin", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)

        const res = await GET(
            createUrlRequest(
                "http://localhost/api/products?admin=true&status=INACTIVE"
            )
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "INACTIVE" },
            })
        )
        expect(data.data).toEqual([])
    })

    it("applies tag filter when tag param is provided", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)

        await GET(
            createUrlRequest("http://localhost/api/products?tag=game,key")
        )

        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: "ACTIVE",
                    tags: { some: { slug: { in: ["game", "key"] } } },
                }),
            })
        )
    })

    it("applies search and pagination", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)

        await GET(
            createUrlRequest(
                "http://localhost/api/products?q=test&page=2&pageSize=5"
            )
        )

        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    name: { contains: "test", mode: "insensitive" },
                }),
                skip: 5,
                take: 5,
            })
        )
    })
})

describe("POST /api/products", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await POST(
            createJsonRequest({
                name: "Test",
                slug: "test",
                price: 99,
            })
        )
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

        const res = await POST(
            createJsonRequest({
                slug: "test",
                price: 99,
            })
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
        expect(data.details).toBeDefined()
    })

    it("returns 409 when slug already exists", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "existing",
            slug: "test",
        } as any)

        const res = await POST(
            createJsonRequest({
                name: "Test Product",
                slug: "test",
                price: 99,
            })
        )
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data).toEqual({
            error: "A product with this slug already exists",
        })
    })

    it("creates product and returns 201 with tag relation", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce(null)
        const created = {
            id: "prod_new",
            name: "New Product",
            slug: "new-product",
            description: "Desc",
            image: null,
            price: 199,
            maxQuantity: 10,
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [
                { id: "tag_1", name: "Game", slug: "game" },
            ],
        }
        prismaMock.product.create.mockResolvedValueOnce(created)

        const res = await POST(
            createJsonRequest({
                name: "New Product",
                slug: "new-product",
                description: "Desc",
                price: 199,
                maxQuantity: 10,
                tagIds: ["tag_1"],
            })
        )
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({
            id: "prod_new",
            name: "New Product",
            slug: "new-product",
            price: 199,
            status: "ACTIVE",
        })
        expect(prismaMock.product.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: "New Product",
                slug: "new-product",
                description: "Desc",
                price: 199,
                maxQuantity: 10,
                status: "ACTIVE",
                tags: { connect: [{ id: "tag_1" }] },
            }),
            include: expect.any(Object),
        })
    })
})
