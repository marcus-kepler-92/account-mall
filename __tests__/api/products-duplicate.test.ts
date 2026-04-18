import { type NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { POST } from "@/app/api/products/[productId]/duplicate/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma")
  return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getSuperAdminSession: jest.fn(),
}))

import { getSuperAdminSession } from "@/lib/auth-guard"

type RouteContext = { params: Promise<{ productId: string }> }

function createContext(productId: string): RouteContext {
  return { params: Promise.resolve({ productId }) }
}

const mockRequest = {} as NextRequest

const baseProduct = {
  id: "prod_1",
  name: "Test Product",
  slug: "test-product",
  description: null,
  summary: null,
  image: null,
  price: new Prisma.Decimal("99"),
  maxQuantity: 10,
  status: "ACTIVE",
  productType: "NORMAL",
  sourceUrl: null,
  validityHours: null,
  allowAccountSwitch: false,
  accountSwitchLimit: 1,
  riskWarningEnabled: false,
  riskWarningTitle: null,
  riskWarningContent: null,
  riskWarningCountdown: null,
  riskWarningConfirmText: null,
  purchaseLimitEnabled: false,
  purchaseLimitQuantity: 1,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
}

describe("POST /api/products/[productId]/duplicate", () => {
  it("returns 401 when not super admin", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValueOnce(null)

    const res = await POST(mockRequest, createContext("prod_1"))
    expect(res.status).toBe(401)
  })

  it("returns 404 when product not found", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValueOnce({ user: { id: "admin_1" } })
    prismaMock.product.findUnique.mockResolvedValueOnce(null)

    const res = await POST(mockRequest, createContext("prod_1"))
    expect(res.status).toBe(404)
  })

  it("creates duplicate with 副本 name and -copy slug when slug is free", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValueOnce({ user: { id: "admin_1" } })
    // findUnique: original product
    prismaMock.product.findUnique.mockResolvedValueOnce(baseProduct)
    // findUnique: slug collision check → null (free)
    prismaMock.product.findUnique.mockResolvedValueOnce(null)
    prismaMock.product.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 5 } } as never)
    const created = { ...baseProduct, id: "prod_2", name: "Test Product 副本", slug: "test-product-copy", status: "INACTIVE", sortOrder: 6 }
    prismaMock.product.create.mockResolvedValueOnce(created)

    const res = await POST(mockRequest, createContext("prod_1"))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ id: "prod_2" })
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Test Product 副本",
          slug: "test-product-copy",
          status: "INACTIVE",
          sortOrder: 6,
        }),
      })
    )
  })

  it("increments slug suffix when -copy is already taken", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValueOnce({ user: { id: "admin_1" } })
    prismaMock.product.findUnique
      .mockResolvedValueOnce(baseProduct)                         // original
      .mockResolvedValueOnce({ ...baseProduct, slug: "test-product-copy" })  // -copy taken
      .mockResolvedValueOnce(null)                               // -copy-2 free
    prismaMock.product.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 0 } } as never)
    const created = { ...baseProduct, id: "prod_3", slug: "test-product-copy-2", status: "INACTIVE", sortOrder: 1 }
    prismaMock.product.create.mockResolvedValueOnce(created)

    const res = await POST(mockRequest, createContext("prod_1"))
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual({ id: "prod_3" })
    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "test-product-copy-2" }),
      })
    )
  })

  it("sets status to INACTIVE regardless of original status", async () => {
    ;(getSuperAdminSession as jest.Mock).mockResolvedValueOnce({ user: { id: "admin_1" } })
    prismaMock.product.findUnique
      .mockResolvedValueOnce({ ...baseProduct, status: "ACTIVE" })
      .mockResolvedValueOnce(null)
    prismaMock.product.aggregate.mockResolvedValueOnce({ _max: { sortOrder: 2 } } as never)
    prismaMock.product.create.mockResolvedValueOnce({ ...baseProduct, id: "prod_4", status: "INACTIVE" })

    await POST(mockRequest, createContext("prod_1"))

    expect(prismaMock.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "INACTIVE" }),
      })
    )
  })
})
