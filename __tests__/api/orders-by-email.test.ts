import { type NextRequest } from "next/server"
import { GET } from "@/app/api/orders/by-email/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return {
    __esModule: true,
    prisma: prismaMock,
  }
})

jest.mock("@/lib/rate-limit", () => ({
  checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

function createUrlRequest(url: string): NextRequest {
  return {
    url,
  } as unknown as NextRequest
}

describe("GET /api/orders/by-email", () => {
  it("returns 429 when query rate limited", async () => {
    const { checkOrderQueryRateLimit } = require("@/lib/rate-limit")
    ;(checkOrderQueryRateLimit as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    )
    const req = createUrlRequest(
      "http://localhost/api/orders/by-email?email=user@example.com",
    )
    const res = await GET(req)
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain("Too many")
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 when email is missing or invalid", async () => {
    const req = createUrlRequest("http://localhost/api/orders/by-email")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Validation failed" })
  })

  it("applies default pagination when page and pageSize are not provided", async () => {
    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.order.count.mockResolvedValue(0)

    const req = createUrlRequest(
      "http://localhost/api/orders/by-email?email=user@example.com",
    )
    const res = await GET(req)

    expect(res.status).toBe(200)

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: "user@example.com",
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      }),
    )
  })
  it("returns paginated orders for given email with limited fields", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "COMPLETED",
        paidAt: new Date(),
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        updatedAt: new Date("2024-02-13T00:00:00.000Z"),
        product: {
          name: "Test Product",
        },
      } as any,
    ])

    prismaMock.order.count.mockResolvedValue(1)

    const req = createUrlRequest(
      "http://localhost/api/orders/by-email?email=User@Example.com&page=1&pageSize=10",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: "user@example.com",
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      }),
    )

    expect(data.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    expect(data.data).toHaveLength(1)
    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    expect(data.data[0]).toEqual({
      orderNo: "FAK202402130001",
      createdAt: createdAt.toISOString(),
      status: "COMPLETED",
      productName: "Test Product",
      quantity: 2,
      amount: 100,
    })
  })
})

