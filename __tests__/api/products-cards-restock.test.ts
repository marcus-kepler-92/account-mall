import { type NextRequest } from "next/server"
import { GET, POST } from "@/app/api/products/[productId]/cards/route"
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
  getAdminSession: jest.fn().mockResolvedValue({ id: "admin_1" }),
}))

jest.mock("@/lib/restock-notify", () => ({
  __esModule: true,
  notifyRestockSubscribers: jest.fn().mockResolvedValue(undefined),
}))

import { getAdminSession } from "@/lib/auth-guard"
import { notifyRestockSubscribers } from "@/lib/restock-notify"

type RouteContext = {
  params: Promise<{ productId: string }>
}

const productId = "prod_1"

function createContext(): RouteContext {
  return { params: Promise.resolve({ productId }) }
}

function createUrlRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("GET /api/products/[productId]/cards", () => {
  const adminSessionMock = getAdminSession as jest.Mock

  beforeEach(() => {
    adminSessionMock.mockReset()
    adminSessionMock.mockResolvedValue({ id: "admin_1" })
  })

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)

    const res = await GET(createUrlRequest("http://localhost"), createContext() as any)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("returns 404 when product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null)

    const res = await GET(createUrlRequest("http://localhost"), createContext() as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Product not found" })
  })

  it("returns cards and stats for product", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId })
    prismaMock.card.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        content: "card1",
        status: "UNSOLD",
        createdAt: new Date("2024-01-01"),
        order: null,
      },
    ])
    prismaMock.card.groupBy.mockResolvedValueOnce([
      { status: "UNSOLD", _count: { id: 5 } },
      { status: "RESERVED", _count: { id: 2 } },
      { status: "SOLD", _count: { id: 3 } },
    ])

    const res = await GET(createUrlRequest("http://localhost"), createContext() as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.cards).toHaveLength(1)
    expect(data.cards[0]).toMatchObject({
      id: "c1",
      content: "card1",
      status: "UNSOLD",
      orderNo: null,
    })
    expect(data.stats).toEqual({ UNSOLD: 5, RESERVED: 2, SOLD: 3 })
  })

  it("applies status filter when status param is provided", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId })
    prismaMock.card.findMany.mockResolvedValueOnce([])
    prismaMock.card.groupBy.mockResolvedValueOnce([])

    await GET(
      createUrlRequest("http://localhost?status=UNSOLD"),
      createContext() as any
    )

    expect(prismaMock.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId, status: "UNSOLD" },
      })
    )
  })
})

describe("POST /api/products/[productId]/cards", () => {
  const adminSessionMock = getAdminSession as jest.Mock
  const context = createContext()

  beforeEach(() => {
    adminSessionMock.mockReset()
    adminSessionMock.mockResolvedValue({ id: "admin_1" })
    ;(notifyRestockSubscribers as jest.Mock).mockClear()
  })

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)

    const res = await POST(
      createJsonRequest({ contents: ["a"] }),
      context as any
    )
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("returns 404 when product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null)

    const res = await POST(
      createJsonRequest({ contents: ["a"] }),
      context as any
    )
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Product not found" })
  })

  it("returns 400 when body is invalid JSON", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId })

    const req = {
      json: async () => {
        throw new Error("bad json")
      },
    } as unknown as NextRequest

    const res = await POST(req, context as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data).toEqual({ error: "Invalid JSON body" })
  })

  it("returns 400 when validation fails (missing contents)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId })

    const res = await POST(createJsonRequest({}), context as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("Validation failed")
  })

  it("returns 201 and imported count when import succeeds", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId })
    prismaMock.card.count.mockResolvedValueOnce(1)
    prismaMock.card.createMany.mockResolvedValueOnce({ count: 2 } as any)

    const res = await POST(
      createJsonRequest({ contents: ["line1", "line2"] }),
      context as any
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ imported: 2, total: 2 })
  })
})

describe("/api/products/[productId]/cards POST restock trigger", () => {
  const context = createContext()

  const validBody = {
    contents: [" card1 ", "card2", "card1"], // includes duplicate & whitespace
  }

  beforeEach(() => {
    ;(notifyRestockSubscribers as jest.Mock).mockClear()
  })

  it("calls notifyRestockSubscribers when old stock is 0 and new cards are imported", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: productId,
      name: "Test Product",
      slug: "test-product",
      price: 19.9,
    } as any)

    prismaMock.card.count.mockResolvedValue(0)
    prismaMock.card.createMany.mockResolvedValue({ count: 2 } as any)

    const req = createJsonRequest(validBody)
    const res = await POST(req, context as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ imported: 2, total: 2 })
    expect(notifyRestockSubscribers).toHaveBeenCalledTimes(1)
    expect(notifyRestockSubscribers).toHaveBeenCalledWith({
      id: productId,
      name: "Test Product",
      slug: "test-product",
      price: 19.9,
    })
  })

  it("does not call notifyRestockSubscribers when old stock is greater than 0", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: productId,
    } as any)

    prismaMock.card.count.mockResolvedValue(3)
    prismaMock.card.createMany.mockResolvedValue({ count: 2 } as any)

    const req = createJsonRequest(validBody)
    const res = await POST(req, context as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ imported: 2, total: 2 })
    expect(notifyRestockSubscribers).not.toHaveBeenCalled()
  })

  it("returns 400 and does not call count or notify when there are no valid contents", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      id: productId,
    } as any)

    const body = { contents: ["  ", "  "] }
    const req = createJsonRequest(body)
    const res = await POST(req, context as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toBe("No valid card contents to import")
    expect(prismaMock.card.count).not.toHaveBeenCalled()
    expect(notifyRestockSubscribers).not.toHaveBeenCalled()
  })
})

