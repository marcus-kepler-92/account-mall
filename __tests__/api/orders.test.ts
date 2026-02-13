import { type NextRequest } from "next/server"
import { GET } from "@/app/api/orders/route"
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

jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  hashPassword: jest.fn().mockResolvedValue("test-hash"),
  verifyPassword: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

function createUrlRequest(url: string): NextRequest {
  return {
    url,
  } as unknown as NextRequest
}

describe("GET /api/orders (admin list)", () => {
  const adminSessionMock = getAdminSession as jest.Mock

  beforeEach(() => {
    adminSessionMock.mockReset()
  })

  it("returns 401 when admin is not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)

    const req = createUrlRequest("http://localhost/api/orders")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 when query validation fails", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    const req = createUrlRequest("http://localhost/api/orders?page=abc&pageSize=10")
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("returns 400 when dateFrom is after dateTo", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    const url =
      "http://localhost/api/orders?dateFrom=2024-02-02T00:00:00.000Z&dateTo=2024-01-01T00:00:00.000Z"
    const req = createUrlRequest(url)

    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Bad request")
    expect(data.message).toContain("dateFrom")
  })

  it("returns paginated orders with computed card counts", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "PENDING",
        paidAt: null,
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        updatedAt: new Date("2024-02-13T00:00:00.000Z"),
        passwordHash: "hash",
        product: {
          id: "prod_1",
          name: "Test Product",
          price: 50,
        },
        cards: [
          { status: "RESERVED" },
          { status: "SOLD" },
          { status: "UNSOLD" },
        ],
      } as any,
    ])

    prismaMock.order.count.mockResolvedValue(1)

    const url =
      "http://localhost/api/orders?page=1&pageSize=20&status=PENDING&email=User@Example.com"
    const req = createUrlRequest(url)

    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          email: "user@example.com",
        }),
      }),
    )

    expect(data.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })

    expect(data.data).toHaveLength(1)
    expect(data.data[0]).toMatchObject({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      product: {
        id: "prod_1",
        name: "Test Product",
        price: 50,
      },
      quantity: 2,
      amount: 100,
      status: "PENDING",
      cardsCount: 3,
      reservedCardsCount: 1,
      soldCardsCount: 1,
    })
  })

  it("applies orderNo contains filter when orderNo is provided", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.order.count.mockResolvedValue(0)

    const req = createUrlRequest(
      "http://localhost/api/orders?page=1&pageSize=20&orderNo=FAK20240213",
    )
    const res = await GET(req)

    expect(res.status).toBe(200)

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderNo: {
            contains: "FAK20240213",
          },
        }),
      }),
    )
  })

  it("does not apply status filter when status is ALL", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.order.count.mockResolvedValue(0)

    const req = createUrlRequest(
      "http://localhost/api/orders?page=1&pageSize=20&status=ALL",
    )
    const res = await GET(req)

    expect(res.status).toBe(200)

    expect(prismaMock.order.findMany).toHaveBeenCalled()
    const args = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(args.where.status).toBeUndefined()
  })

  it("parses simple dateFrom/dateTo strings and applies createdAt range", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    prismaMock.order.findMany.mockResolvedValue([])
    prismaMock.order.count.mockResolvedValue(0)

    const req = createUrlRequest(
      "http://localhost/api/orders?dateFrom=2024-02-13&dateTo=2024-02-15",
    )
    const res = await GET(req)

    expect(res.status).toBe(200)

    const args = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(args.where.createdAt).toBeDefined()
    expect(args.where.createdAt.gte).toBeInstanceOf(Date)
    expect(args.where.createdAt.lte).toBeInstanceOf(Date)
  })

  it("returns 400 when dateFrom is invalid", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    const req = createUrlRequest(
      "http://localhost/api/orders?dateFrom=not-a-date&dateTo=2024-02-15",
    )
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Bad request")
    expect(data.message).toContain("Invalid dateFrom format")
  })
})

