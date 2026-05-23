import { type NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
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
    getSuperAdminSession: jest.fn(),
}))

import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard"

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
        // groupBy is called in every GET request; default to empty (no stock data)
        prismaMock.card.groupBy.mockResolvedValue([] as any)
        prismaMock.productVariant.groupBy.mockResolvedValue([] as any)
    })

    it("returns only ACTIVE products for public request (no admin param)", async () => {
        const products = [
            {
                id: "p1",
                name: "Product 1",
                slug: "product-1",
                status: "ACTIVE",
                price: new Prisma.Decimal("100"),
                tags: [],
            },
        ]
        prismaMock.product.findMany.mockResolvedValueOnce(products as any)
        prismaMock.product.count.mockResolvedValueOnce(1)
        prismaMock.card.groupBy.mockResolvedValueOnce([
            { productId: "p1", _count: { id: 3 } },
        ] as any)

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

    it("aggregates variant stockQuantity for MANUAL products (no cards table)", async () => {
        const products = [
            {
                id: "p_manual",
                name: "Manual Product",
                slug: "manual-product",
                status: "ACTIVE",
                productType: "MANUAL",
                price: new Prisma.Decimal("50"),
                tags: [],
            },
            {
                id: "p_normal",
                name: "Normal Product",
                slug: "normal-product",
                status: "ACTIVE",
                productType: "NORMAL",
                price: new Prisma.Decimal("100"),
                tags: [],
            },
        ]
        prismaMock.product.findMany.mockResolvedValueOnce(products as any)
        prismaMock.product.count.mockResolvedValueOnce(products.length)
        // NORMAL product has 2 UNSOLD cards; MANUAL has none.
        prismaMock.card.groupBy.mockResolvedValueOnce([
            { productId: "p_normal", _count: { id: 2 } },
        ] as any)
        // MANUAL product has 7 active variant stock total.
        prismaMock.productVariant.groupBy.mockResolvedValueOnce([
            { productId: "p_manual", _sum: { stockQuantity: 7 } },
        ] as any)

        const res = await GET(createUrlRequest("http://localhost/api/products"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.productVariant.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                by: ["productId"],
                where: { productId: { in: ["p_manual"] }, isActive: true },
                _sum: { stockQuantity: true },
            })
        )
        const manual = data.data.find((p: { id: string }) => p.id === "p_manual")
        const normal = data.data.find((p: { id: string }) => p.id === "p_normal")
        expect(manual.stock).toBe(7)
        expect(manual.productType).toBe("MANUAL")
        expect(normal.stock).toBe(2)
    })

    it("returns stock=0 for MANUAL product when no active variants exist", async () => {
        const products = [
            {
                id: "p_empty_manual",
                name: "Empty Manual",
                slug: "empty-manual",
                status: "ACTIVE",
                productType: "MANUAL",
                price: new Prisma.Decimal("9.9"),
                tags: [],
            },
        ]
        prismaMock.product.findMany.mockResolvedValueOnce(products as any)
        prismaMock.product.count.mockResolvedValueOnce(1)
        prismaMock.card.groupBy.mockResolvedValueOnce([] as any)
        prismaMock.productVariant.groupBy.mockResolvedValueOnce([] as any)

        const res = await GET(createUrlRequest("http://localhost/api/products"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data[0].stock).toBe(0)
        expect(data.data[0].productType).toBe("MANUAL")
    })

    it("skips ProductVariant.groupBy when no MANUAL products are returned", async () => {
        const products = [
            {
                id: "p_normal_only",
                name: "Normal Only",
                slug: "normal-only",
                status: "ACTIVE",
                productType: "NORMAL",
                price: new Prisma.Decimal("10"),
                tags: [],
            },
        ]
        prismaMock.product.findMany.mockResolvedValueOnce(products as any)
        prismaMock.product.count.mockResolvedValueOnce(1)
        prismaMock.card.groupBy.mockResolvedValueOnce([
            { productId: "p_normal_only", _count: { id: 5 } },
        ] as any)

        const res = await GET(createUrlRequest("http://localhost/api/products"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.productVariant.groupBy).not.toHaveBeenCalled()
        expect(data.data[0].stock).toBe(5)
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

    it("applies ACTIVE filter when admin and status=ACTIVE", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)
        const res = await GET(
            createUrlRequest("http://localhost/api/products?admin=true&status=ACTIVE")
        )
        expect(res.status).toBe(200)
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: "ACTIVE" },
            })
        )
    })

    it("applies sort price-desc when sort=price-desc", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)
        await GET(createUrlRequest("http://localhost/api/products?sort=price-desc"))
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: expect.arrayContaining([expect.objectContaining({ price: "desc" })]),
            })
        )
    })

    it("applies sort newest when sort=newest", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)
        await GET(createUrlRequest("http://localhost/api/products?sort=newest"))
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: expect.arrayContaining([expect.objectContaining({ createdAt: "desc" })]),
            })
        )
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

    it("uses ACTIVE filter for public request", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)

        await GET(createUrlRequest("http://localhost/api/products"))

        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: "ACTIVE",
                }),
            })
        )
    })

    it("uses sortOrder ASC as default sort", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([])
        prismaMock.product.count.mockResolvedValueOnce(0)

        await GET(createUrlRequest("http://localhost/api/products"))

        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: [{ sortOrder: "asc" }],
            })
        )
    })
})

describe("POST /api/products", () => {
    const superAdminSessionMock = getSuperAdminSession as jest.Mock

    beforeEach(() => {
        superAdminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        superAdminSessionMock.mockResolvedValueOnce(null)

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
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
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
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

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
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
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

    it("creates product without tags when tagIds empty", async () => {
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 4 } } as any)
        prismaMock.product.create.mockResolvedValueOnce({
            id: "p1",
            name: "No Tags",
            slug: "no-tags",
            description: null,
            image: null,
            price: 50,
            maxQuantity: 10,
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
        } as any)
        const res = await POST(
            createJsonRequest({
                name: "No Tags",
                slug: "no-tags",
                price: 50,
            })
        )
        expect(res.status).toBe(201)
        expect(prismaMock.product.create).toHaveBeenCalledWith({
            data: expect.not.objectContaining({
                tags: expect.anything(),
            }),
            include: expect.any(Object),
        })
    })

    it("rejects MANUAL + ACTIVE create with 422 (variants must exist first)", async () => {
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(
            createJsonRequest({
                name: "Manual Product",
                slug: "manual-product",
                price: 0,
                productType: "MANUAL",
                status: "ACTIVE",
            })
        )
        const data = await res.json()

        expect(res.status).toBe(422)
        expect(data.error).toBe("手动发货商品上架前需先创建至少一个启用的 SKU")
        // No DB calls should have been made past the guard.
        expect(prismaMock.product.findUnique).not.toHaveBeenCalled()
        expect(prismaMock.product.create).not.toHaveBeenCalled()
    })

    it("rejects MANUAL create that defaults to ACTIVE status", async () => {
        // status defaults to ACTIVE when not provided, so the guard must also
        // catch the omit-status case.
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

        const res = await POST(
            createJsonRequest({
                name: "Manual Product",
                slug: "manual-product-default",
                price: 0,
                productType: "MANUAL",
            })
        )

        expect(res.status).toBe(422)
        expect(prismaMock.product.create).not.toHaveBeenCalled()
    })

    it("creates product and returns 201 with tag relation", async () => {
        superAdminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce(null)
        prismaMock.product.aggregate.mockResolvedValueOnce({ _max: { sortOrder: null } } as any)
        const created = {
            id: "prod_new",
            name: "New Product",
            slug: "new-product",
            description: "Desc",
            image: null,
            price: new Prisma.Decimal("199"),
            maxQuantity: 10,
            status: "ACTIVE",
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [
                { id: "tag_1", name: "Game", slug: "game" },
            ],
        }
        prismaMock.product.create.mockResolvedValueOnce(created as any)

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
