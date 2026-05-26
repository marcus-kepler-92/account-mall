/**
 * Tests for /api/products cs-token integration:
 *  - Without ?cs: products returned with no discountPercent field
 *  - With valid cs: eligible products get discountPercent
 *  - With cs but admin view: ignored (admin sees raw catalog)
 *  - resolver returning empty map (invalid/expired token): no field added
 */

import type { NextRequest } from "next/server"
import { GET } from "@/app/api/products/route"
import { prismaMock } from "../../__mocks__/prisma"
import { Prisma } from "@prisma/client"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})
jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
    getSuperAdminSession: jest.fn(),
}))
jest.mock("@/lib/revalidate-storefront", () => ({
    __esModule: true,
    revalidateProducts: jest.fn(),
}))
jest.mock("@/lib/cross-sell", () => ({
    __esModule: true,
    resolveCrossSellDiscounts: jest.fn(),
}))
jest.mock("@/lib/config", () => ({
    config: { autoFetchMaxQuantityPerOrder: 5 },
    getConfig: () => ({ autoFetchMaxQuantityPerOrder: 5 }),
}))

function buildRequest(url: string): NextRequest {
    return { url } as unknown as NextRequest
}

const baseProduct = {
    id: "prod_a",
    name: "Product A",
    slug: "product-a",
    description: null,
    summary: null,
    image: null,
    price: new Prisma.Decimal("100.00"),
    productType: "NORMAL",
    status: "ACTIVE",
    sortOrder: 0,
    sourceUrl: null,
    tags: [],
}

describe("GET /api/products — cross-sell discount integration", () => {
    const resolveCrossSellDiscounts = require("@/lib/cross-sell")
        .resolveCrossSellDiscounts as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        resolveCrossSellDiscounts.mockResolvedValue(new Map())
        prismaMock.product.findMany.mockResolvedValue([
            baseProduct,
            { ...baseProduct, id: "prod_b", slug: "product-b", name: "Product B" },
        ] as any)
        prismaMock.product.count.mockResolvedValue(2)
        prismaMock.card.groupBy.mockResolvedValue([
            { productId: "prod_a", _count: { id: 5 } },
            { productId: "prod_b", _count: { id: 3 } },
        ] as any)
    })

    it("does NOT call resolver when no cs param is present", async () => {
        const res = await GET(buildRequest("http://localhost/api/products"))
        const body = await res.json()
        expect(resolveCrossSellDiscounts).not.toHaveBeenCalled()
        for (const p of body.data) {
            expect(p.discountPercent).toBeUndefined()
        }
    })

    it("calls resolver with cs token and product IDs", async () => {
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map())
        await GET(buildRequest("http://localhost/api/products?cs=valid.cs.token"))
        expect(resolveCrossSellDiscounts).toHaveBeenCalledWith(
            "valid.cs.token",
            ["prod_a", "prod_b"],
        )
    })

    it("attaches discountPercent only to products returned by resolver", async () => {
        resolveCrossSellDiscounts.mockResolvedValueOnce(
            new Map([["prod_a", 10]]),
        )
        const res = await GET(buildRequest("http://localhost/api/products?cs=valid.cs.token"))
        const body = await res.json()
        const a = body.data.find((p: { id: string }) => p.id === "prod_a")
        const b = body.data.find((p: { id: string }) => p.id === "prod_b")
        expect(a.discountPercent).toBe(10)
        expect(b.discountPercent).toBeUndefined()
    })

    it("emits no discountPercent fields when resolver returns empty map (invalid/expired cs)", async () => {
        resolveCrossSellDiscounts.mockResolvedValueOnce(new Map())
        const res = await GET(buildRequest("http://localhost/api/products?cs=expired.cs.token"))
        const body = await res.json()
        for (const p of body.data) {
            expect(p.discountPercent).toBeUndefined()
        }
    })

    it("skips cross-sell resolution in admin view", async () => {
        const { getAdminSession } = require("@/lib/auth-guard")
        getAdminSession.mockResolvedValueOnce({ user: { id: "admin", role: "ADMIN" } })

        await GET(buildRequest("http://localhost/api/products?admin=true&cs=valid.cs.token"))

        expect(resolveCrossSellDiscounts).not.toHaveBeenCalled()
    })
})
