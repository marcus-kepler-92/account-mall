import { type NextRequest } from "next/server"
import { GET, PUT, DELETE } from "@/app/api/products/[productId]/route"
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

type RouteContext = { params: Promise<{ productId: string }> }

function createContext(productId: string): RouteContext {
    return { params: Promise.resolve({ productId }) }
}

function createUrlRequest(url: string): NextRequest {
    return { url } as unknown as NextRequest
}

function createJsonRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
    } as unknown as NextRequest
}

describe("GET /api/products/[productId]", () => {
    it("returns 404 when product does not exist", async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce(null)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_1"),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found" })
    })

    it("returns product with stock count when found", async () => {
        const product = {
            id: "prod_1",
            name: "Test",
            slug: "test",
            description: null,
            image: null,
            price: 50,
            maxQuantity: 5,
            status: "ACTIVE",
            secretCode: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [{ id: "t1", name: "Tag", slug: "tag" }],
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(7)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_1"),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "prod_1",
            name: "Test",
            slug: "test",
            price: 50,
            stock: 7,
        })
        expect(prismaMock.product.findUnique).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            include: {
                tags: { select: { id: true, name: true, slug: true } },
            },
        })
    })

    it("returns 404 when product has secretCode but no code param provided", async () => {
        const product = {
            id: "prod_secret",
            name: "Secret",
            slug: "secret",
            secretCode: "hidden",
            price: 50,
            tags: [],
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_secret"),
            createContext("prod_secret")
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found" })
    })

    it("returns 404 when product has secretCode and code param does not match", async () => {
        const product = {
            id: "prod_secret",
            name: "Secret",
            slug: "secret",
            secretCode: "hidden",
            price: 50,
            tags: [],
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_secret?code=wrong"),
            createContext("prod_secret")
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found" })
    })

    it("returns product when secretCode matches code param", async () => {
        const product = {
            id: "prod_secret",
            name: "Secret Product",
            slug: "secret",
            secretCode: "correct",
            price: 100,
            tags: [],
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(5)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_secret?code=correct"),
            createContext("prod_secret")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "prod_secret",
            name: "Secret Product",
            price: 100,
            stock: 5,
        })
    })

    it("returns product without secretCode when no code param", async () => {
        const product = {
            id: "prod_public",
            name: "Public",
            slug: "public",
            secretCode: null,
            price: 50,
            tags: [],
        }
        prismaMock.product.findUnique.mockResolvedValueOnce(product)
        prismaMock.card.count.mockResolvedValueOnce(3)

        const res = await GET(
            createUrlRequest("http://localhost/api/products/prod_public"),
            createContext("prod_public")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "prod_public",
            name: "Public",
        })
    })
})

describe("PUT /api/products/[productId]", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await PUT(
            createJsonRequest({ name: "Updated" }),
            createContext("prod_1")
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

        const res = await PUT(req, createContext("prod_1"))
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data).toEqual({ error: "Invalid JSON body" })
    })

    it("returns 400 when validation fails", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            slug: "test",
        })

        const res = await PUT(
            createJsonRequest({ price: -1 }),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toBe("Validation failed")
    })

    it("returns 404 when product does not exist", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce(null)

        const res = await PUT(
            createJsonRequest({ name: "Updated" }),
            createContext("nonexistent")
        )
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found" })
    })

    it("returns 409 when new slug already exists", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique
            .mockResolvedValueOnce({
                id: "prod_1",
                slug: "old-slug",
            })
            .mockResolvedValueOnce({
                id: "other",
                slug: "taken-slug",
            })

        const res = await PUT(
            createJsonRequest({ slug: "taken-slug" }),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data).toEqual({
            error: "A product with this slug already exists",
        })
    })

    it("updates product with tagIds and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            slug: "test",
        })
        const updated = {
            id: "prod_1",
            name: "Prod",
            slug: "test",
            price: 50,
            tags: [
                { id: "tag_1", name: "T1", slug: "t1" },
                { id: "tag_2", name: "T2", slug: "t2" },
            ],
        }
        prismaMock.product.update.mockResolvedValueOnce(updated)

        const res = await PUT(
            createJsonRequest({ tagIds: ["tag_1", "tag_2"] }),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            data: expect.objectContaining({
                tags: {
                    set: [{ id: "tag_1" }, { id: "tag_2" }],
                },
            }),
            include: expect.any(Object),
        })
        expect(data.tags).toHaveLength(2)
    })

    it("updates product and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            slug: "test",
        })
        const updated = {
            id: "prod_1",
            name: "Updated Name",
            slug: "test",
            price: 99,
            tags: [],
        }
        prismaMock.product.update.mockResolvedValueOnce(updated)

        const res = await PUT(
            createJsonRequest({ name: "Updated Name", price: 99 }),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "prod_1",
            name: "Updated Name",
            price: 99,
        })
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            data: expect.objectContaining({
                name: "Updated Name",
                price: 99,
            }),
            include: expect.any(Object),
        })
    })

    it("updates product secretCode", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            slug: "test",
        })
        const updated = {
            id: "prod_1",
            slug: "test",
            secretCode: "newsecret",
            price: 50,
            tags: [],
        }
        prismaMock.product.update.mockResolvedValueOnce(updated)

        const res = await PUT(
            createJsonRequest({ secretCode: "newsecret" }),
            createContext("prod_1")
        )
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            data: expect.objectContaining({
                secretCode: "newsecret",
            }),
            include: expect.any(Object),
        })
    })

    it("clears secretCode when set to empty string", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            slug: "test",
            secretCode: "oldsecret",
        })
        const updated = {
            id: "prod_1",
            slug: "test",
            secretCode: null,
            price: 50,
            tags: [],
        }
        prismaMock.product.update.mockResolvedValueOnce(updated)

        const res = await PUT(
            createJsonRequest({ secretCode: "" }),
            createContext("prod_1")
        )

        expect(res.status).toBe(200)
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            data: expect.objectContaining({
                secretCode: null,
            }),
            include: expect.any(Object),
        })
    })
})

describe("DELETE /api/products/[productId]", () => {
    const adminSessionMock = getAdminSession as jest.Mock

    beforeEach(() => {
        adminSessionMock.mockReset()
    })

    it("returns 401 when not authenticated", async () => {
        adminSessionMock.mockResolvedValueOnce(null)

        const res = await DELETE({} as NextRequest, createContext("prod_1"))
        const data = await res.json()

        expect(res.status).toBe(401)
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 404 when product does not exist", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce(null)

        const res = await DELETE({} as NextRequest, createContext("nonexistent"))
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data).toEqual({ error: "Product not found" })
    })

    it("soft-deletes product and returns 200", async () => {
        adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
        prismaMock.product.findUnique.mockResolvedValueOnce({
            id: "prod_1",
            name: "Test",
        })
        prismaMock.product.update.mockResolvedValueOnce({})

        const res = await DELETE({} as NextRequest, createContext("prod_1"))
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toEqual({ message: "Product deactivated" })
        expect(prismaMock.product.update).toHaveBeenCalledWith({
            where: { id: "prod_1" },
            data: { status: "INACTIVE" },
        })
    })
})
