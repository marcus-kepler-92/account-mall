import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/lookup/route"
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

jest.mock("@/lib/order-success-token", () => ({
  createOrderSuccessToken: jest.fn().mockReturnValue(null),
}))

jest.mock("@/lib/config", () => ({
  __esModule: true,
  config: { pendingOrderTimeoutMs: 15 * 60 * 1000 },
  getConfig: () => ({ pendingOrderTimeoutMs: 15 * 60 * 1000 }),
}))

import { verifyPassword } from "better-auth/crypto"

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("POST /api/orders/lookup", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    ;(prismaMock.$transaction as jest.Mock).mockReset()
  })

  it("returns 429 when rate limited (black-box)", async () => {
    const { checkOrderQueryRateLimit } = require("@/lib/rate-limit")
    ;(checkOrderQueryRateLimit as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    )
    const res = await POST(
      createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" }),
    )
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toMatch(/Too many|try again/)
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

  it("returns 400 when validation fails", async () => {
    const req = createJsonRequest({ orderNo: "", password: "" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 400 with fuzzy error when order does not exist", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique.mockResolvedValueOnce(null)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
  })

  it("returns 500 when transaction throws non-LOOKUP_FAILED error", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
      throw new Error("Database connection failed")
    })
    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it("returns 400 with fuzzy error when password is incorrect", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      passwordHash: "hash",
      status: "PENDING",
      product: {
        name: "Test Product",
      },
      cards: [],
      createdAt: new Date(),
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(false)

    const req = createJsonRequest({
      orderNo: "FAK202402130001",
      // length >= 6 so it passes schema validation but still fails password check
      password: "wrong123",
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
  })

  it("returns PENDING order with isPending and no cards when password is correct", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    // Within timeout so canPay is true
    const createdAt = new Date(Date.now() - 5 * 60 * 1000)

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      passwordHash: "hash",
      status: "PENDING",
      amount: 99,
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "RESERVED" },
        { id: "card_2", content: "code-2", status: "UNSOLD" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(verifyPasswordMock).toHaveBeenCalledWith({ hash: "hash", password: "secret123" })
    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(prismaMock.card.updateMany).not.toHaveBeenCalled()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      status: "PENDING",
      cards: [],
      isPending: true,
      canPay: true,
    })
    expect(data.createdAt).toBe(createdAt.toISOString())
    expect(typeof data.expiresAt).toBe("string")
    expect(new Date(data.expiresAt).getTime()).toBe(
      createdAt.getTime() + 15 * 60 * 1000,
    )
  })

  it("returns PENDING order with canPay false when past timeout", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    // 20 min ago, past 15 min timeout
    const createdAt = new Date(Date.now() - 20 * 60 * 1000)
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130002",
      passwordHash: "hash",
      status: "PENDING",
      amount: 99,
      product: { name: "Test Product" },
      cards: [],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ orderNo: "FAK202402130002", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      orderNo: "FAK202402130002",
      status: "PENDING",
      isPending: true,
      canPay: false,
    })
    expect(data.expiresAt).toBe(
      new Date(createdAt.getTime() + 15 * 60 * 1000).toISOString(),
    )
  })

  it("returns existing COMPLETED order without changing status on lookup", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      passwordHash: "hash",
      status: "COMPLETED",
      amount: 99,
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "SOLD" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      status: "COMPLETED",
      amount: 99,
      cards: [{ content: "code-1" }],
    })
  })

  it("returns COMPLETED order with successToken when token is generated (black-box)", async () => {
    const { createOrderSuccessToken } = require("@/lib/order-success-token")
    ;(createOrderSuccessToken as jest.Mock).mockReturnValueOnce("stub-success-token")
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )
    const createdAt = new Date("2024-02-13T00:00:00.000Z")
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      passwordHash: "hash",
      status: "COMPLETED",
      amount: 99,
      product: { name: "Test Product" },
      cards: [{ id: "c1", content: "card-content", status: "SOLD" }],
      createdAt,
    } as any)
    verifyPasswordMock.mockResolvedValueOnce(true)

    const res = await POST(
      createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" }),
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orderNo).toBe("FAK202402130001")
    expect(data.status).toBe("COMPLETED")
    expect(data.cards).toEqual([{ content: "card-content" }])
    expect(data.successToken).toBe("stub-success-token")
  })
})

