import { type NextRequest } from "next/server"
import { GET } from "@/app/api/products/[productId]/cards/export/route"
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

import { getAdminSession } from "@/lib/auth-guard"

type RouteContext = {
  params: Promise<{ productId: string }>
}

const productId = "prod_1"

function createContext(): RouteContext {
  return { params: Promise.resolve({ productId }) }
}

function createRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest
}

describe("GET /api/products/[productId]/cards/export", () => {
  const adminSessionMock = getAdminSession as jest.Mock

  beforeEach(() => {
    adminSessionMock.mockReset()
    adminSessionMock.mockResolvedValue({ id: "admin_1" })
  })

  it("returns 401 when not authenticated", async () => {
    adminSessionMock.mockResolvedValueOnce(null)

    const res = await GET(createRequest("http://localhost"), createContext() as any)
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data).toEqual({ error: "Unauthorized" })
  })

  it("returns 404 when product does not exist", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null)

    const res = await GET(createRequest("http://localhost"), createContext() as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data).toEqual({ error: "Product not found" })
  })

  it("returns text/plain with all card contents joined by newline", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId, name: "Netflix Premium" } as any)
    prismaMock.card.findMany.mockResolvedValueOnce([
      { content: "user1|pass1" },
      { content: "user2|pass2" },
    ] as any)

    const res = await GET(createRequest("http://localhost"), createContext() as any)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/plain")
    expect(text).toBe("user1|pass1\nuser2|pass2")
  })

  it("filters by status when valid status param is provided", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId, name: "Test" } as any)
    prismaMock.card.findMany.mockResolvedValueOnce([{ content: "card1" }] as any)

    await GET(createRequest("http://localhost?status=UNSOLD"), createContext() as any)

    expect(prismaMock.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId, status: "UNSOLD" },
      })
    )
  })

  it("ignores invalid status param and queries all cards", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId, name: "Test" } as any)
    prismaMock.card.findMany.mockResolvedValueOnce([])

    await GET(createRequest("http://localhost?status=BOGUS"), createContext() as any)

    expect(prismaMock.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId },
      })
    )
  })

  it("sets Content-Disposition attachment header with filename containing product name and status label", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId, name: "Netflix Premium" } as any)
    prismaMock.card.findMany.mockResolvedValueOnce([])

    const res = await GET(createRequest("http://localhost?status=UNSOLD"), createContext() as any)
    const disposition = res.headers.get("Content-Disposition") ?? ""

    expect(disposition).toContain("attachment")
    expect(disposition).toContain("Netflix")
    expect(disposition).toContain("%E6%9C%AA%E5%94%AE") // "未售" URL-encoded
    expect(disposition).toMatch(/\.txt/)
  })

  it("returns empty body when product has no cards", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce({ id: productId, name: "Empty Product" } as any)
    prismaMock.card.findMany.mockResolvedValueOnce([])

    const res = await GET(createRequest("http://localhost"), createContext() as any)
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe("")
  })
})
