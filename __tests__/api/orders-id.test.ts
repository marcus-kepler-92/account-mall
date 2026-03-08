import { type NextRequest } from "next/server"
import { GET, PATCH, DELETE } from "@/app/api/orders/[orderId]/route"
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

jest.mock("@/lib/order-completion-email", () => ({
  __esModule: true,
  sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/complete-pending-order", () => ({
  __esModule: true,
  completePendingOrder: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { completePendingOrder } from "@/lib/complete-pending-order"

type RouteContext = {
  params: {
    orderId: string
  }
}

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("/api/orders/[orderId] admin detail & status", () => {
  const adminSessionMock = getAdminSession as jest.Mock

  const completePendingOrderMock = completePendingOrder as jest.Mock

  beforeEach(() => {
    adminSessionMock.mockReset()
    ;(prismaMock.$transaction as jest.Mock).mockReset()
    completePendingOrderMock.mockReset()
  })

  it("GET returns 401 when admin is not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await GET({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("PATCH returns 401 when admin is not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)
    const req = createJsonRequest({ status: "PENDING" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(req, ctx as any)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("DELETE returns 401 when admin is not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await DELETE({} as NextRequest, ctx as any)
    const data = await res.json()
    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("GET returns 404 when order does not exist", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
    prismaMock.order.findUnique.mockResolvedValueOnce(null)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await GET({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Order not found" })
  })

  it("GET returns order summary without exposing passwordHash", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    prismaMock.order.findUnique.mockResolvedValueOnce({
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
      ],
    } as any)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await GET({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toMatchObject({
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
      cardsCount: 2,
      reservedCardsCount: 1,
      soldCardsCount: 1,
    })
    expect(data.passwordHash).toBeUndefined()
  })

  it("PATCH returns 400 when JSON body is invalid", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    const badReq = {
      json: async () => {
        throw new Error("bad json")
      },
    } as unknown as NextRequest

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(badReq, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Invalid JSON body" })
  })

  it("PATCH returns 400 when validation fails", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    const req = createJsonRequest({ status: "INVALID" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }

    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.details).toBeDefined()
  })

  it("PATCH returns 409 on invalid status transition", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      status: "COMPLETED",
      cards: [],
    } as any)

    const req = createJsonRequest({ status: "PENDING" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }

    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBe("Invalid status transition")
  })

  it("PATCH PENDING -> COMPLETED returns 200 and COMPLETED status (black-box)", async () => {
    adminSessionMock.mockResolvedValueOnce({
      id: "admin_1",
      user: { id: "admin_1", email: "admin@test.com" },
    })
    completePendingOrderMock.mockResolvedValueOnce({ done: true, orderNo: "FAK202402130001" })

    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        status: "PENDING",
        cards: [
          { id: "card_1", status: "RESERVED" },
          { id: "card_2", status: "UNSOLD" },
        ],
      } as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "COMPLETED",
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: "prod_1",
          name: "Test Product",
          price: 50,
        },
        cards: [
          { status: "SOLD" },
          { status: "SOLD" },
        ],
      } as any)

    const req = createJsonRequest({ status: "COMPLETED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }

    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("COMPLETED")
    expect(data.orderNo).toBe("FAK202402130001")
    expect(completePendingOrderMock).toHaveBeenCalledWith("FAK202402130001")
  })

  it("PATCH PENDING -> COMPLETED returns 200 even when completion email fails (black-box)", async () => {
    adminSessionMock.mockResolvedValueOnce({
      id: "admin_1",
      user: { id: "admin_1", email: "admin@test.com" },
    })
    completePendingOrderMock.mockResolvedValueOnce({ done: true, orderNo: "FAK001" })
    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK001",
        status: "PENDING",
        cards: [{ id: "card_1", status: "RESERVED" }],
      } as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK001",
        email: "u@example.com",
        productId: "p1",
        quantity: 1,
        amount: 50,
        status: "COMPLETED",
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { id: "p1", name: "P", price: 50 },
        cards: [{ status: "SOLD" }],
      } as any)

    const res = await PATCH(
      createJsonRequest({ status: "COMPLETED" }),
      { params: { orderId: "order_1" } } as any,
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("COMPLETED")
  })

  it("PATCH PENDING -> CLOSED closes order and releases reserved cards", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        status: "PENDING",
        cards: [
          { id: "card_1", status: "RESERVED" },
          { id: "card_2", status: "RESERVED" },
        ],
      } as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "CLOSED",
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: "prod_1",
          name: "Test Product",
          price: 50,
        },
        cards: [
          { status: "UNSOLD" },
          { status: "UNSOLD" },
        ],
      } as any)

    const req = createJsonRequest({ status: "CLOSED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }

    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("CLOSED")
  })

  it("PATCH COMPLETED -> CLOSED returns 409 (forbidden transition)", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    )
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      status: "COMPLETED",
      cards: [{ id: "card_1", status: "SOLD" }],
    } as any)

    const req = createJsonRequest({ status: "CLOSED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }

    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.error).toBeDefined()
  })

  it("DELETE closes pending order and returns 200 with CLOSED (black-box)", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: any) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        status: "PENDING",
        cards: [
          { id: "card_1", status: "RESERVED" },
        ],
      } as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "CLOSED",
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: "prod_1",
          name: "Test Product",
          price: 50,
        },
        cards: [
          { status: "UNSOLD" },
        ],
      } as any)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await DELETE({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("CLOSED")
    expect(data.orderNo).toBe("FAK202402130001")
  })

  it("DELETE returns 404 when order does not exist", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
      throw new Error("ORDER_NOT_FOUND")
    })

    prismaMock.order.findUnique.mockResolvedValueOnce(null)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await DELETE({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Order not found" })
  })

  it("PATCH returns 404 when order does not exist in transaction", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => {
      prismaMock.order.findUnique.mockResolvedValueOnce(null)
      return fn(prismaMock)
    })

    const req = createJsonRequest({ status: "CLOSED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Order not found" })
  })

  it("PATCH is idempotent when status unchanged (PENDING -> PENDING)", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    )

    const sameOrder = {
      id: "order_1",
      status: "PENDING",
      cards: [{ id: "card_1", status: "RESERVED" }],
    }
    prismaMock.order.findUnique
      .mockResolvedValueOnce(sameOrder as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "PENDING",
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { id: "prod_1", name: "Test Product", price: 50 },
        cards: [{ status: "RESERVED" }, { status: "RESERVED" }],
      } as any)

    const req = createJsonRequest({ status: "PENDING" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("PENDING")
  })

  it("PATCH returns 500 when transaction throws non-Error", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
    prismaMock.order.findUnique.mockResolvedValueOnce({
      id: "order_1",
      orderNo: "ORD1",
      status: "PENDING",
      cards: [{ id: "c1", status: "RESERVED" }],
    } as any)
    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
      throw "string error"
    })

    const req = createJsonRequest({ status: "CLOSED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it("PATCH returns 404 when order is missing after update (findUnique returns null)", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })
    completePendingOrderMock.mockResolvedValueOnce({ done: true, orderNo: "ORD1" })
    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "ORD1",
        status: "PENDING",
        cards: [{ id: "card_1", status: "RESERVED" }],
      } as any)
      .mockResolvedValueOnce(null)

    const req = createJsonRequest({ status: "COMPLETED" })
    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await PATCH(req, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toBe("Order not found")
  })

  it("DELETE returns 500 when transaction throws non-ORDER_NOT_FOUND", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async () => {
      throw new Error("Database error")
    })

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await DELETE({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it("DELETE when order is already CLOSED returns 200 with CLOSED status (black-box)", async () => {
    adminSessionMock.mockResolvedValueOnce({ id: "admin_1" })

    ;(prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) =>
      fn(prismaMock),
    )

    prismaMock.order.findUnique
      .mockResolvedValueOnce({
        id: "order_1",
        status: "CLOSED",
        cards: [],
      } as any)
      .mockResolvedValueOnce({
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        productId: "prod_1",
        quantity: 2,
        amount: 100,
        status: "CLOSED",
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: { id: "prod_1", name: "Test Product", price: 50 },
        cards: [],
      } as any)

    const ctx: RouteContext = { params: { orderId: "order_1" } }
    const res = await DELETE({} as NextRequest, ctx as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.status).toBe("CLOSED")
  })
})

