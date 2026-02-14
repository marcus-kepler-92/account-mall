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

function createJsonRequest(
  body: unknown,
  ip = "192.168.1.1",
): NextRequest {
  return {
    json: async () => body,
    headers: new Headers({
      "x-forwarded-for": ip,
    }),
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

  const activeProductOutOfStock = {
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
  } as any

  it("creates subscription successfully when product is active and out of stock", async () => {
    prismaMock.product.findUnique.mockResolvedValue(activeProductOutOfStock)
    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.restockSubscription.count.mockResolvedValue(0)
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
        productId_ip: {
          productId: "prod_1",
          ip: "192.168.1.1",
        },
      },
      create: {
        productId: "prod_1",
        ip: "192.168.1.1",
        email: "user@example.com",
        status: "PENDING",
      },
      update: {
        email: "user@example.com",
        status: "PENDING",
        updatedAt: expect.any(Date),
      },
    })
  })

  it("subscription is per-product and per-IP: uses productId_ip unique key and normalizes email to lowercase", async () => {
    prismaMock.product.findUnique.mockResolvedValue(activeProductOutOfStock)
    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.restockSubscription.count.mockResolvedValue(0)
    prismaMock.restockSubscription.upsert.mockResolvedValue({} as any)

    const req = createJsonRequest(
      { productId: "prod_1", email: "User@Example.COM" },
      "10.0.0.1",
    )
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ ok: true, subscribed: true })
    expect(prismaMock.restockSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_ip: { productId: "prod_1", ip: "10.0.0.1" } },
        create: {
          productId: "prod_1",
          ip: "10.0.0.1",
          email: "user@example.com",
          status: "PENDING",
        },
      }),
    )
  })

  it("same IP + same product again (including after NOTIFIED) sets PENDING for next restock reminder", async () => {
    prismaMock.product.findUnique.mockResolvedValue(activeProductOutOfStock)
    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.restockSubscription.count.mockResolvedValue(1)
    prismaMock.restockSubscription.upsert.mockResolvedValue({} as any)

    const ip = "203.0.113.2"
    const req = createJsonRequest(baseBody, ip)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ ok: true, subscribed: true })
    expect(prismaMock.restockSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId_ip: { productId: "prod_1", ip } },
        update: {
          email: "user@example.com",
          status: "PENDING",
          updatedAt: expect.any(Date),
        },
      }),
    )
  })

  it("returns 400 when email has reached subscription limit (abuse prevention)", async () => {
    prismaMock.product.findUnique.mockResolvedValue(activeProductOutOfStock)
    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.restockSubscription.count.mockResolvedValue(50)

    const req = createJsonRequest(baseBody)
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Subscription limit reached")
    expect(data.message).toContain("50")
    expect(prismaMock.restockSubscription.upsert).not.toHaveBeenCalled()
  })

  it("returns error when product is in stock", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: "prod_1",
      name: "Test product",
      slug: "test-product",
      status: "ACTIVE",
    } as any)
    prismaMock.restockSubscription.count.mockResolvedValue(0)
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
    prismaMock.restockSubscription.findFirst.mockResolvedValue({
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
    prismaMock.restockSubscription.findFirst.mockResolvedValue({
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
    prismaMock.restockSubscription.findFirst.mockResolvedValue(null)

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

  it("normalizes email in query so lookup is case-insensitive", async () => {
    prismaMock.restockSubscription.findFirst.mockResolvedValue({
      status: "PENDING",
    } as any)

    const req = createUrlRequest(
      "http://localhost/api/restock-subscriptions?productId=prod_1&email=User@Example.COM",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ subscribed: true })
    expect(prismaMock.restockSubscription.findFirst).toHaveBeenCalledWith({
      where: {
        productId: "prod_1",
        email: "user@example.com",
      },
      select: { status: true },
    })
  })
})

