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

  // Helper: configure the fingerprint fast-path query results.
  // The route fires `count` + `findMany` in parallel; both should reflect the
  // fingerprint-matched set.
  function setFingerprintMatches(orders: any[]) {
    ;(prismaMock.order.count as jest.Mock).mockResolvedValueOnce(orders.length)
    ;(prismaMock.order.findMany as jest.Mock).mockResolvedValueOnce(orders)
  }

  // Helper: configure the legacy fallback (passwordFingerprint = null) query.
  // The route runs count + findMany in parallel when the fast path returns
  // zero (on any page — legacy is paginated too so the buyer can reach all
  // of their historical orders).
  function setLegacyFallback(orders: any[], total?: number) {
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

  it("returns 400 with fuzzy error when no fingerprint match and no legacy fallback", async () => {
    setFingerprintMatches([])
    setLegacyFallback([])

    const req = createJsonRequest({ email: "user@example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({
      error: "Order not found or password incorrect",
    })
    // Confirm pre-filter is in effect: the count + findMany must filter on
    // passwordFingerprint (not just email).
    const countCall = (prismaMock.order.count as jest.Mock).mock.calls[0]?.[0]
    expect(countCall.where).toMatchObject({
      email: "user@example.com",
      passwordFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
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

  it("fast path: returns single order when fingerprint matches and password verifies", async () => {
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
          { id: "card_2", content: "code-2", status: "RESERVED" },
        ],
        createdAt,
      },
    ])
    verifyPasswordMock.mockResolvedValueOnce(true)

    const req = createJsonRequest({ email: "User@Example.com", password: "secret123" })
    const res = await POST(req)
    const data = await res.json()

    // Fingerprint pre-filter must be applied to the findMany query.
    const findManyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[0][0]
    expect(findManyCall.where).toMatchObject({
      email: "user@example.com",
      passwordFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(findManyCall.orderBy).toEqual({ createdAt: "desc" })

    expect(verifyPasswordMock).toHaveBeenCalledWith({ hash: "hash", password: "secret123" })

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

  it("falls back to legacy (passwordFingerprint=null) when fast path is empty on page 1", async () => {
    // Fast path returns zero (covered by setFingerprintMatches([])):
    setFingerprintMatches([])
    // Legacy fallback is called next:
    const createdAt = new Date("2023-01-01T00:00:00.000Z")
    setLegacyFallback([
      {
        id: "legacy_1",
        orderNo: "OLD001",
        email: "user@example.com",
        passwordHash: "legacy-hash",
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

    // Second findMany call (the legacy fallback) must filter by null fingerprint.
    const legacyCall = (prismaMock.order.findMany as jest.Mock).mock.calls[1][0]
    expect(legacyCall.where).toMatchObject({
      email: "user@example.com",
      passwordFingerprint: null,
    })
    expect(legacyCall.take).toBe(10)

    expect(res.status).toBe(200)
    expect(data.orderNo).toBe("OLD001")
  })

  it("triggers paginated legacy fallback on page > 1 so buyer can reach all historical orders", async () => {
    // Fast path empty on page 2 — legacy now also paginates so the buyer
    // can reach orders beyond page 1 of their (uncfingerprinted) history.
    setFingerprintMatches([])
    setLegacyFallback([], 0)

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
    // count + fast-path findMany + legacy count + legacy findMany.
    expect((prismaMock.order.findMany as jest.Mock).mock.calls).toHaveLength(2)
    const legacyFindMany = (prismaMock.order.findMany as jest.Mock).mock.calls[1][0]
    expect(legacyFindMany.skip).toBe(10)  // (page-1) * pageSize
    expect(legacyFindMany.take).toBe(10)
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
