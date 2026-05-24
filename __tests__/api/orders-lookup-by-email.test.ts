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

describe("POST /api/orders/lookup-by-email", () => {
  const verifyPasswordMock = verifyPassword as jest.Mock

  beforeEach(() => {
    verifyPasswordMock.mockReset()
    ;(prismaMock.order.count as jest.Mock).mockReset()
    ;(prismaMock.order.findMany as jest.Mock).mockReset()
  })

  // Helper: configure the unified paginated query results.
  // The route fires `count` + `findMany` in parallel over `where: { email }`
  // (no SQL-level fingerprint filter); per-row verify decides match. Helpers
  // kept under the old names as thin aliases so existing tests keep reading
  // naturally — `setFingerprintMatches` configures the row set that the
  // route will iterate; rows with `passwordFingerprint` matching the request
  // skip scrypt, others go through scrypt.
  function setEmailOrders(orders: any[], total?: number) {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(total ?? orders.length)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce(orders)
  }
  const setFingerprintMatches = setEmailOrders
  const setLegacyFallback = (_orders: any[], _total?: number) => {
    // No-op: legacy fallback is merged into the unified query. Tests that
    // previously seeded a second mock layer for "fast empty → legacy" can
    // still call this without effect.
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

  it("returns 400 when validation fails", async () => {
    const req = createJsonRequest({ email: "", password: "" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 400 when email is invalid", async () => {
    const req = createJsonRequest({ email: "invalid-email", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(data.code).toBe("VALIDATION_FAILED")
  })

  it("returns 400 with fuzzy error when no orders exist for the email", async () => {
    setEmailOrders([])

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
    // Unified query: count + findMany filter only on email so the pager can
    // reach legacy-null rows in the same paginated stream.
    const countCall = (prismaMock.order.count as jest.Mock).mock.calls[0]?.[0]
    expect(countCall.where).toEqual({ email: "user@example.com" })
  })

  it("returns 400 when fingerprint matches but verifyPassword rejects (defense in depth)", async () => {
    // Fingerprint mismatches are SQL-prefiltered, but a verify can still
    // reject in pathological scenarios (collision, corrupt hash). Confirm we
    // do not leak access.
    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "PENDING",
        product: { name: "Test Product" },
        cards: [],
        createdAt: new Date(),
      },
    ])
    setLegacyFallback([])
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

  it("fast path: row whose passwordFingerprint matches the request hash skips scrypt", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")
    // Compute the same fingerprint the route would for ("user@example.com",
    // "secret123") so we can pre-seed it on the mock row.
    const { computePasswordFingerprint } = await import("@/lib/order-password-fingerprint")
    const fp = computePasswordFingerprint("user@example.com", "secret123")

    setEmailOrders([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        passwordFingerprint: fp,
        status: "COMPLETED",
        amount: 50,
        product: { name: "Test Product" },
        cards: [
          { id: "card_1", content: "code-1", status: "SOLD" },
          { id: "card_2", content: "code-2", status: "RESERVED" },
        ],
        createdAt,
      },
    ])

    const req = createJsonRequest({ email: "User@Example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    // Unified query filters on email only — fingerprint pre-filter happens
    // per-row, after findMany.
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where).toEqual({ email: "user@example.com" })
    expect(findManyCall.orderBy).toEqual({ createdAt: "desc" })

    // Fast path: scrypt is NOT called when the row's stored fingerprint
    // matches the request fingerprint.
    expect(verifyPasswordMock).not.toHaveBeenCalled()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      createdAt: createdAt.toISOString(),
      status: "COMPLETED",
      amount: 50,
      productType: "NORMAL",
      cards: [
        { content: "code-1" },
        { content: "code-2" },
      ],
      cardTemplates: [],
      fulfillment: null,
      lastDunAt: null,
      successToken: expect.any(String),
    })
  })

  it("returns single PENDING order with isPending when password is correct", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "PENDING",
        amount: 100,
        product: { name: "Test Product" },
        cards: [
          { id: "card_1", content: "code-1", status: "RESERVED" },
          { id: "card_2", content: "code-2", status: "UNSOLD" },
        ],
        createdAt,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(verifyPasswordMock).toHaveBeenCalledWith({ hash: "hash", password: "secret123" })
    expect(prismaMock.order.update).not.toHaveBeenCalled()
    expect(prismaMock.card.updateMany).not.toHaveBeenCalled()

    expect(res.status).toBe(200)
    expect(data).toEqual({
      orderNo: "FAK202402130001",
      productName: "Test Product",
      createdAt: createdAt.toISOString(),
      status: "PENDING",
      amount: 100,
      cards: [],
      isPending: true,
      canPay: expect.any(Boolean),
      expiresAt: expect.any(String),
    })
  })

  it("returns existing COMPLETED order without changing status on lookup", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        amount: 50,
        product: { name: "Test Product" },
        cards: [
          { id: "card_1", content: "code-1", status: "SOLD" },
        ],
        createdAt,
      },
    ])
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
      amount: 50,
      productType: "NORMAL",
      cards: [{ content: "code-1" }],
      cardTemplates: [],
      fulfillment: null,
      lastDunAt: null,
      successToken: expect.any(String),
    })
  })

  it("normalizes email to lowercase when querying", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        product: { name: "Test Product" },
        cards: [],
        createdAt,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "User@Example.COM", password: "secret123" })
    const res = await POST(req)

    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: "user@example.com",
        }),
      }),
    )

    expect(res.status).toBe(200)
  })

  it("only returns cards with SOLD or RESERVED status", async () => {
    const createdAt = new Date("2024-02-13T00:00:00.000Z")

    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK202402130001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        product: { name: "Test Product" },
        cards: [
          { id: "card_1", content: "code-1", status: "SOLD" },
          { id: "card_2", content: "code-2", status: "RESERVED" },
          { id: "card_3", content: "code-3", status: "UNSOLD" },
        ],
        createdAt,
      },
    ])
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

  it("returns 400 when password length is less than 6 after parse", async () => {
    const req = createJsonRequest({ email: "user@example.com", password: "12345" })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
    expect(prismaMock.order.findMany).not.toHaveBeenCalled()
  })

  it("returns paginated list with totals when more than one order matches", async () => {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(2)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "order_1",
        orderNo: "FAK001",
        email: "user@example.com",
        passwordHash: "hash1",
        status: "COMPLETED",
        product: { name: "Product A" },
        cards: [],
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        quantity: 1,
        amount: 50,
      },
      {
        id: "order_2",
        orderNo: "FAK002",
        email: "user@example.com",
        passwordHash: "hash2",
        status: "PENDING",
        product: { name: "Product B" },
        cards: [],
        createdAt: new Date("2024-02-12T00:00:00.000Z"),
        quantity: 2,
        amount: 100,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true).mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.orders).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(10)
    expect(data.totalPages).toBe(1)
    expect(data.orders[0]).toMatchObject({
      orderNo: "FAK001",
      productName: "Product A",
      status: "COMPLETED",
      quantity: 1,
      amount: 50,
    })
    expect(data.orders[1]).toMatchObject({
      orderNo: "FAK002",
      productName: "Product B",
      status: "PENDING",
      quantity: 2,
      amount: 100,
    })
  })

  it("respects pageSize=2 and reports totalPages correctly when total exceeds pageSize", async () => {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(5)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: "order_a",
        orderNo: "FAK00A",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        product: { name: "P" },
        cards: [],
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        quantity: 1,
        amount: 10,
      },
      {
        id: "order_b",
        orderNo: "FAK00B",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        product: { name: "P" },
        cards: [],
        createdAt: new Date("2024-02-12T00:00:00.000Z"),
        quantity: 1,
        amount: 10,
      },
    ])
    verifyPasswordMock.mockResolvedValue(true)

    const req = createJsonRequest({
      email: "user@example.com",
      password: "secret123",
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

    // Confirm skip/take were derived from page/pageSize.
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.skip).toBe(0)
    expect(findManyCall.take).toBe(2)
  })

  it("legacy row (passwordFingerprint=null) reaches scrypt and returns when verify passes", async () => {
    const createdAt = new Date("2023-01-01T00:00:00.000Z")
    setEmailOrders([
      {
        id: "legacy_1",
        orderNo: "OLD001",
        email: "user@example.com",
        passwordHash: "legacy-hash",
        passwordFingerprint: null,
        status: "COMPLETED",
        amount: 25,
        product: { name: "Legacy Product" },
        cards: [{ id: "card_1", content: "x", status: "SOLD" }],
        createdAt,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    // Legacy row → scrypt was invoked as authoritative verify.
    expect(verifyPasswordMock).toHaveBeenCalledWith({ hash: "legacy-hash", password: "secret123" })

    expect(res.status).toBe(200)
    expect(data.orderNo).toBe("OLD001")
  })

  it("paginates by email so the buyer can reach all orders across mixed fingerprint/null rows", async () => {
    // page > 1 still runs the unified count + findMany pair — no behavior
    // difference between pages, no double-cost-vs-fast-path distinction.
    setEmailOrders([], 0)

    const req = createJsonRequest({
      email: "user@example.com",
      password: "secret123",
      page: 2,
      pageSize: 10,
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Order not found or password incorrect" })
    // Single unified count + findMany, no separate legacy path.
    expect((prismaMock.order.findMany as jest.Mock).mock.calls).toHaveLength(1)
    const findMany = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findMany.skip).toBe(10) // (page-1) * pageSize
    expect(findMany.take).toBe(10)
    expect(findMany.where).toEqual({ email: "user@example.com" })
  })

  it("returns 500 when single order has no product (LOOKUP_FAILED)", async () => {
    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK001",
        email: "user@example.com",
        passwordHash: "hash",
        status: "COMPLETED",
        product: null,
        cards: [],
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        quantity: 1,
        amount: 50,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true)
    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data.error).toBeDefined()
  })

  it("skips order with corrupt password hash and reports not found", async () => {
    setFingerprintMatches([
      {
        id: "order_1",
        orderNo: "FAK001",
        email: "user@example.com",
        passwordHash: "hash1",
        status: "COMPLETED",
        product: { name: "Product A" },
        cards: [],
        createdAt: new Date("2024-02-13T00:00:00.000Z"),
        quantity: 1,
        amount: 50,
      },
    ])
    setLegacyFallback([])
    verifyPasswordMock.mockRejectedValueOnce(new Error("corrupt hash"))

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Order not found or password incorrect")
  })
})
