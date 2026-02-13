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
    expect(data).toEqual({ error: "Validation failed" })
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

  it("completes PENDING order and returns cards when password is correct", async () => {
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
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
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
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

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
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

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "FAK202402130001",
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

    const req = createJsonRequest({ orderNo: "FAK202402130001", password: "secret123" })
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
})

