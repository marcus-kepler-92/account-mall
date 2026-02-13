import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/lookup-by-email/route"
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

import { verifyPassword } from "better-auth/crypto"

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("POST /api/orders/lookup-by-email", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    ;(prismaMock.$transaction as jest.Mock).mockReset()
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
    const req = createJsonRequest({ email: "", password: "" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Validation failed" })
  })

  it("returns 400 when email is invalid", async () => {
    const req = createJsonRequest({ email: "invalid-email", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Validation failed" })
  })

  it("returns 400 with fuzzy error when order does not exist", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findFirst.mockResolvedValueOnce(null)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
  })

  it("returns 400 with fuzzy error when password is incorrect", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
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
      email: "user@example.com",
      password: "wrong123",
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
  })

  it("finds the most recent order by email and returns it when password is correct", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "COMPLETED",
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "SOLD" },
        { id: "card_2", content: "code-2", status: "RESERVED" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "User@Example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: "user@example.com",
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    )

    expect(verifyPasswordMock).toHaveBeenCalledWith("secret123", "hash")

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      createdAt: createdAt.toISOString(),
      status: "COMPLETED",
      cards: [
        { content: "code-1" },
        { content: "code-2" },
      ],
    })
  })

  it("completes PENDING order and returns cards when password is correct", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "PENDING",
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "RESERVED" },
        { id: "card_2", content: "code-2", status: "UNSOLD" },
      ],
      createdAt,
    } as any)

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "COMPLETED",
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "SOLD" },
        { id: "card_2", content: "code-2", status: "SOLD" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(verifyPasswordMock).toHaveBeenCalledWith("secret123", "hash")

    expect(prismaMock.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          paidAt: expect.any(Date),
        }),
      }),
    )

    expect(prismaMock.card.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          orderId: "order_1",
          status: "RESERVED",
        },
        data: {
          status: "SOLD",
        },
      }),
    )

    expect(prismaMock.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
      }),
    )

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      createdAt: createdAt.toISOString(),
      status: "COMPLETED",
      cards: [
        { content: "code-1" },
        { content: "code-2" },
      ],
    })
  })

  it("returns existing COMPLETED order without changing status on lookup", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "COMPLETED",
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "SOLD" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(prismaMock.card.updateMany).not.toHaveBeenCalled()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      createdAt: createdAt.toISOString(),
      status: "COMPLETED",
      cards: [{ content: "code-1" }],
    })
  })

  it("normalizes email to lowercase when querying", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "COMPLETED",
      product: {
        name: "Test Product",
      },
      cards: [],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "User@Example.COM", password: "secret123" })
    const res = await POST(req)

    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: "user@example.com",
        },
      }),
    )

    expect(res.status).toBe(200)
  })

  it("only returns cards with SOLD or RESERVED status", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findFirst.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
      email: "user@example.com",
      passwordHash: "hash",
      status: "COMPLETED",
      product: {
        name: "Test Product",
      },
      cards: [
        { id: "card_1", content: "code-1", status: "SOLD" },
        { id: "card_2", content: "code-2", status: "RESERVED" },
        { id: "card_3", content: "code-3", status: "UNSOLD" },
      ],
      createdAt,
    } as any)

    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.cards).toEqual([
      { content: "code-1" },
      { content: "code-2" },
    ])
    expect(data.cards).not.toContainEqual({ content: "code-3" })
  })
})
