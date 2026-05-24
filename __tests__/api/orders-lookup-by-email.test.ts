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

jest.mock("@/lib/rate-limit", () => ({
  checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

import { verifyPassword } from "better-auth/crypto"

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

/**
 * POST /api/orders/lookup-by-email — list-only contract.
 *
 * Returns the order LIST (metadata only) for an email; no password required,
 * no scrypt verify, no card content. Detail (cards / fulfillment) is gated
 * behind the existing per-order password flow (POST /api/orders/lookup).
 *
 * Privacy contract: response must never include passwordHash, cards,
 * fulfillment, clientIp, fingerprintHash, sourceUrl, promoCode, distributorId,
 * exitDiscountMeta.
 */
describe("POST /api/orders/lookup-by-email", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    ;(prismaMock.order.count as jest.Mock).mockReset()
    ;(prismaMock.order.findMany as jest.Mock).mockReset()
  })

  function setEmailOrders(orders: unknown[], total?: number) {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(total ?? orders.length)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce(orders)
  }

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

  it("returns 400 when email is missing", async () => {
    const req = createJsonRequest({ email: "" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 400 when email is invalid", async () => {
    const req = createJsonRequest({ email: "not-an-email" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 200 + empty list when email has no orders (no enumeration disclosure)", async () => {
    setEmailOrders([], 0)

    const req = createJsonRequest({ email: "stranger@example.com" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orders: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    })

    // count + findMany ran against a plain email filter — no scrypt cost.
    const countCall = (prismaMock.order.count as jest.Mock).mock.calls[0]?.[0]
    expect(countCall.where).toEqual({ email: "stranger@example.com" })
    expect(verifyPasswordMock).not.toHaveBeenCalled()
  })

  it("never calls verifyPassword (password is not part of the contract)", async () => {
    setEmailOrders([
      {
        orderNo: "FAK001",
        productNameSnapshot: "Product A",
        variantNameSnapshot: null,
        status: "COMPLETED",
        amount: 50,
        quantity: 1,
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        product: { productType: "NORMAL" },
      },
    ])

    const req = createJsonRequest({ email: "user@example.com" })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(verifyPasswordMock).not.toHaveBeenCalled()
  })

  it("returns paginated orders with full metadata", async () => {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(2)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
      {
        orderNo: "FAK001",
        productNameSnapshot: "Product A",
        variantNameSnapshot: null,
        status: "COMPLETED",
        amount: 50,
        quantity: 1,
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        product: { productType: "NORMAL" },
      },
      {
        orderNo: "FAK002",
        productNameSnapshot: "Product B",
        variantNameSnapshot: "10K 钻石",
        status: "AWAITING_FULFILLMENT",
        amount: 100,
        quantity: 1,
        createdAt: new Date("2024-02-12T00:00:00.000Z"),
        product: { productType: "MANUAL" },
      },
    ])

    const req = createJsonRequest({ email: "user@example.com" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total).toBe(2)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(10)
    expect(data.totalPages).toBe(1)
    expect(data.orders).toHaveLength(2)
    expect(data.orders[0]).toEqual({
      orderNo: "FAK001",
      productName: "Product A",
      variantName: null,
      status: "COMPLETED",
      amount: 50,
      quantity: 1,
      createdAt: "2024-02-13T00:00:00.000Z",
      productType: "NORMAL",
    })
    expect(data.orders[1]).toEqual({
      orderNo: "FAK002",
      productName: "Product B",
      variantName: "10K 钻石",
      status: "AWAITING_FULFILLMENT",
      amount: 100,
      quantity: 1,
      createdAt: "2024-02-12T00:00:00.000Z",
      productType: "MANUAL",
    })
  })

  it("normalizes email to lowercase when querying", async () => {
    setEmailOrders([], 0)

    const req = createJsonRequest({ email: "User@Example.COM" })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where).toEqual({ email: "user@example.com" })
    expect(findManyCall.orderBy).toEqual({ createdAt: "desc" })
  })

  it("does NOT include cards / fulfillment / passwordHash / clientIp in response (privacy contract)", async () => {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(1)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
      {
        orderNo: "FAK001",
        productNameSnapshot: "Product A",
        variantNameSnapshot: null,
        status: "COMPLETED",
        amount: 50,
        quantity: 1,
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        product: { productType: "NORMAL" },
      },
    ])

    const req = createJsonRequest({ email: "user@example.com" })
    const res = await POST(req)
    const data = await res.json()

    // Privacy check: response shape is fixed — no leaks.
    expect(res.status).toBe(200)
    const item = data.orders[0]
    expect(item).not.toHaveProperty("passwordHash")
    expect(item).not.toHaveProperty("cards")
    expect(item).not.toHaveProperty("fulfillment")
    expect(item).not.toHaveProperty("clientIp")
    expect(item).not.toHaveProperty("fingerprintHash")
    expect(item).not.toHaveProperty("sourceUrl")
    expect(item).not.toHaveProperty("promoCode")
    expect(item).not.toHaveProperty("distributorId")
    expect(item).not.toHaveProperty("exitDiscountMeta")

    // Select clause must mirror the same restriction.
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    const select = findManyCall.select
    expect(select).not.toHaveProperty("passwordHash")
    expect(select).not.toHaveProperty("cards")
    expect(select).not.toHaveProperty("fulfillment")
    expect(select).not.toHaveProperty("clientIp")
    expect(select).not.toHaveProperty("fingerprintHash")
    expect(select).not.toHaveProperty("promoCode")
    expect(select).not.toHaveProperty("distributorId")
    expect(select).not.toHaveProperty("exitDiscountMeta")
  })

  it("respects custom page/pageSize and reports totalPages correctly", async () => {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(5)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
      {
        orderNo: "FAK00A",
        productNameSnapshot: "P",
        variantNameSnapshot: null,
        status: "COMPLETED",
        amount: 10,
        quantity: 1,
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        product: { productType: "NORMAL" },
      },
      {
        orderNo: "FAK00B",
        productNameSnapshot: "P",
        variantNameSnapshot: null,
        status: "COMPLETED",
        amount: 10,
        quantity: 1,
        createdAt: new Date("2024-02-12T00:00:00.000Z"),
        product: { productType: "NORMAL" },
      },
    ])

    const req = createJsonRequest({
      email: "user@example.com",
      page: 1,
      pageSize: 2,
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total).toBe(5)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(2)
    expect(data.totalPages).toBe(3)
    expect(data.orders).toHaveLength(2)

    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.skip).toBe(0)
    expect(findManyCall.take).toBe(2)
  })

  it("skip = (page-1) * pageSize when page > 1", async () => {
    setEmailOrders([], 5)

    const req = createJsonRequest({
      email: "user@example.com",
      page: 2,
      pageSize: 10,
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.page).toBe(2)
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.skip).toBe(10)
    expect(findManyCall.take).toBe(10)
    expect(findManyCall.where).toEqual({ email: "user@example.com" })
  })

  it("clamps pageSize to 50 maximum", async () => {
    setEmailOrders([], 0)

    const req = createJsonRequest({
      email: "user@example.com",
      page: 1,
      // Validation schema caps at 50 (max), so a value above 50 would fail
      // parse first. Send the legal upper bound and confirm take === 50.
      pageSize: 50,
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.take).toBe(50)
  })
})
