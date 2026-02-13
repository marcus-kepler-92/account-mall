import { type NextRequest } from "next/server"
import { POST, GET } from "@/app/api/restock-subscriptions/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  // Import inside factory to avoid initialization order issues
  const { prismaMock } = require("../../__mocks__/prisma")
  return {
    __esModule: true,
    prisma: prismaMock,
  }
})

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

function createUrlRequest(url: string): NextRequest {
  return {
    url,
  } as unknown as NextRequest
}

describe("/api/restock-subscriptions POST", () => {
  const baseBody = {
    productId: "prod_1",
    email: "User@Example.com",
  }

  it("creates subscription successfully when product is active and out of stock", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: "prod_1",
      name: "Test product",
      slug: "test-product",
      status: "ACTIVE",
      description: null,
      image: null,
      price: 10,
      maxQuantity: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
      cards: [],
      orders: [],
      tags: [],
      restockSubscriptions: [],
    } as any)

    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.restockSubscription.upsert.mockResolvedValue({
      id: "sub_1",
      productId: "prod_1",
      email: "user@example.com",
      status: "PENDING",
      notifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      product: undefined as any,
    })

    const req = createJsonRequest(baseBody)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ ok: true, subscribed: true })
    expect(prismaMock.restockSubscription.upsert).toHaveBeenCalledWith({
      where: {
        productId_email: {
          productId: "prod_1",
          email: "user@example.com",
        },
      },
      create: {
        productId: "prod_1",
        email: "user@example.com",
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        updatedAt: expect.any(Date),
      },
    })
  })

  it("returns error when product is in stock", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: "prod_1",
      name: "Test product",
      slug: "test-product",
      status: "ACTIVE",
    } as any)

    prismaMock.card.count.mockResolvedValue(5)

    const req = createJsonRequest(baseBody)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Product is in stock")
    expect(data.message).toContain("当前有货")
  })

  it("returns 404 when product does not exist or is inactive", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null)

    const req = createJsonRequest(baseBody)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Product not found or unavailable" })
  })

  it("returns 400 when validation fails", async () => {
    const invalidBody = {
      productId: "",
      email: "not-an-email",
    }

    const req = createJsonRequest(invalidBody)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when JSON body is invalid", async () => {
    const badReq = {
      json: async () => {
        throw new Error("bad json")
      },
    } as unknown as NextRequest

    const res = await POST(badReq)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Invalid JSON body" })
  })
})

describe("/api/restock-subscriptions GET", () => {
  it("returns subscribed true when status is PENDING", async () => {
    prismaMock.restockSubscription.findUnique.mockResolvedValue({
      id: "sub_1",
      productId: "prod_1",
      email: "user@example.com",
      status: "PENDING",
      notifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      product: undefined as any,
    } as any)

    const req = createUrlRequest(
      "http://localhost/api/restock-subscriptions?productId=prod_1&email=user@example.com",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ subscribed: true })
  })

  it("returns subscribed false when status is NOTIFIED", async () => {
    prismaMock.restockSubscription.findUnique.mockResolvedValue({
      status: "NOTIFIED",
    } as any)

    const req = createUrlRequest(
      "http://localhost/api/restock-subscriptions?productId=prod_1&email=user@example.com",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ subscribed: false })
  })

  it("returns subscribed false when subscription does not exist", async () => {
    prismaMock.restockSubscription.findUnique.mockResolvedValue(null)

    const req = createUrlRequest(
      "http://localhost/api/restock-subscriptions?productId=prod_1&email=user@example.com",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ subscribed: false })
  })

  it("returns 400 when productId or email is missing", async () => {
    const req = createUrlRequest(
      "http://localhost/api/restock-subscriptions?productId=prod_1",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("productId and email are required")
  })
})

