import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/orders/by-email/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return {
    __esModule: true,
    prisma: prismaMock,
  }
})

jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  verifyPassword: jest.fn(),
}))

jest.mock("@/lib/rate-limit", () => ({
  checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

import { verifyPassword } from "better-auth/crypto"

function createUrlRequest(url: string): NextRequest {
  return {
    url,
  } as unknown as NextRequest
}

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("GET /api/orders/by-email", () => {
  it("returns 400 with message to use POST with password", async () => {
    const req = createUrlRequest(
      "http://localhost/api/orders/by-email?email=user@example.com",
    )
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toContain("POST")
    expect(data.error).toContain("password")
  })
})

describe("POST /api/orders/by-email", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    prismaMock.order.findMany.mockReset()
  })

  it("returns 400 when body is not valid JSON", async () => {
    const req = {
      json: async () => {
        throw new Error("Invalid JSON")
      },
    } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Invalid JSON body")
  })

  it("returns 429 when rate limited", async () => {
    const { checkOrderQueryRateLimit } = require("@/lib/rate-limit")
    ;(checkOrderQueryRateLimit as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    )
    const req = createJsonRequest({
      email: "user@example.com",
      password: "secret123",
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })

  it("returns 400 when email or password missing or invalid", async () => {
    const req = createJsonRequest({ email: "user@example.com" })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: "Validation failed" })
  })

  it("returns 400 when no orders match password", async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        orderNo: "ord1",
        createdAt: new Date(),
        status: "PENDING",
        quantity: 1,
        amount: 99,
        passwordHash: "hash",
        product: { name: "P" },
      },
    ])
    verifyPasswordMock.mockResolvedValue(false)

    const req = createJsonRequest({
      email: "user@example.com",
      password: "wrong12",
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/order not found|password incorrect/i)
  })

  it("returns paginated orders when email and password match", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")
    prismaMock.order.findMany.mockResolvedValue([
      {
        orderNo: "FAK202402130001",
        createdAt,
        status: "COMPLETED",
        quantity: 2,
        amount: 100,
        passwordHash: "hash",
        product: { name: "Test Product" },
      },
    ])
    verifyPasswordMock.mockResolvedValue(true)

    const req = createJsonRequest({
      email: "User@Example.com",
      password: "secret123",
      page: 1,
      pageSize: 10,
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "user@example.com" },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    )
    expect(data.meta).toEqual({
      total: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })
    expect(data.data).toHaveLength(1)
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
