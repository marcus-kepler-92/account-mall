import { type NextRequest } from "next/server"
import { POST } from "@/app/api/products/[productId]/cards/route"
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

import { notifyRestockSubscribers } from "@/lib/restock-notify"

type RouteContext = {
  params: Promise<{ productId: string }>
}

function createJsonRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest
}

describe("/api/products/[productId]/cards POST restock trigger", () => {
  const productId = "prod_1"

  const context: RouteContext = {
    params: Promise.resolve({ productId }),
  }

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

