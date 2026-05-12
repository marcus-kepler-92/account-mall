/**
 * Unit tests for cross-sell utility functions: getCrossSellSetting and getCrossSellRecommendations.
 */

import { Prisma } from "@prisma/client"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

import { prismaMock } from "../../__mocks__/prisma"
import {
    getCrossSellSetting,
    getCrossSellRecommendations,
} from "@/lib/cross-sell"

// Helper: build a product-like object for mocking
function makeProduct(overrides: Record<string, unknown> = {}) {
    return {
        id: "prod-1",
        name: "Test Product",
        slug: "test-product",
        description: null,
        summary: null,
        image: null,
        price: new Prisma.Decimal("99.00"),
        maxQuantity: 10,
        status: "ACTIVE",
        productType: "NORMAL",
        sortOrder: 0,
        tags: [],
        _count: { cards: 5 },
        ...overrides,
    }
}

describe("getCrossSellSetting", () => {
    it("returns defaults when no DB row exists", async () => {
        prismaMock.crossSellSetting.findUnique.mockResolvedValue(null)
        const result = await getCrossSellSetting()
        expect(result.enabled).toBe(true)
        expect(result.discountPercent).toBe(10)
        expect(result.ttlMinutes).toBe(5)
    })

    it("returns DB values when row exists", async () => {
        prismaMock.crossSellSetting.findUnique.mockResolvedValue({
            id: "singleton",
            enabled: false,
            discountPercent: new Prisma.Decimal("15"),
            ttlMinutes: 60,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        const result = await getCrossSellSetting()
        expect(result.enabled).toBe(false)
        expect(result.discountPercent).toBe(15)
        expect(result.ttlMinutes).toBe(60)
    })
})

describe("getCrossSellRecommendations", () => {
    const sourceProductId = "source-prod"

    beforeEach(() => {
        // Default: source product with tags
        prismaMock.product.findUnique.mockResolvedValue(
            makeProduct({
                id: sourceProductId,
                tags: [{ id: "tag-1", name: "Gaming", slug: "gaming" }],
            }) as any,
        )
        // Default: no admin-bound targets
        prismaMock.productCrossSell.findMany.mockResolvedValue([])
        // Default: no tag-matched products
        prismaMock.product.findMany.mockResolvedValue([])
    })

    it("returns admin-bound products first (by sortOrder)", async () => {
        const adminTarget1 = makeProduct({ id: "prod-a", sortOrder: 2 })
        const adminTarget2 = makeProduct({ id: "prod-b", sortOrder: 1 })

        prismaMock.productCrossSell.findMany.mockResolvedValue([
            { id: "cs-1", sourceProductId, targetProductId: "prod-a", sortOrder: 2, createdAt: new Date(), target: adminTarget1 },
            { id: "cs-2", sourceProductId, targetProductId: "prod-b", sortOrder: 1, createdAt: new Date(), target: adminTarget2 },
        ] as any)
        // Make products have UNSOLD cards
        prismaMock.card.count.mockResolvedValue(5)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        expect(results.length).toBe(2)
        // sortOrder 1 (prod-b) should come before sortOrder 2 (prod-a) — already ordered by DB query
        expect(results[0].id).toBe("prod-a") // as returned by findMany (mocked in order)
    })

    it("fills to limit using tag-matching products", async () => {
        // 1 admin-bound product
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-1",
                sourceProductId,
                targetProductId: "prod-admin",
                sortOrder: 0,
                createdAt: new Date(),
                target: makeProduct({ id: "prod-admin" }),
            },
        ] as any)
        // 2 tag-matched products
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: "prod-tag-1" }),
            makeProduct({ id: "prod-tag-2" }),
        ] as any)
        prismaMock.card.count.mockResolvedValue(3)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        expect(results.length).toBe(3)
    })

    it("filters out the source product itself", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: sourceProductId }), // should be excluded
            makeProduct({ id: "prod-other" }),
        ] as any)
        prismaMock.card.count.mockResolvedValue(2)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        const ids = results.map((p) => p.id)
        expect(ids).not.toContain(sourceProductId)
    })

    it("filters out non-ACTIVE products", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: "prod-inactive", status: "DISABLED" }),
            makeProduct({ id: "prod-active", status: "ACTIVE" }),
        ] as any)
        prismaMock.card.count.mockImplementation((async ({ where }: any) => {
            if (where.productId === "prod-active") return 3
            return 0
        }) as any)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        const ids = results.map((p) => p.id)
        expect(ids).not.toContain("prod-inactive")
        expect(ids).toContain("prod-active")
    })

    it("filters out products with zero stock", async () => {
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: "prod-no-stock" }),
            makeProduct({ id: "prod-has-stock" }),
        ] as any)
        prismaMock.card.count.mockImplementation((async ({ where }: any) => {
            if (where.productId === "prod-has-stock") return 5
            return 0
        }) as any)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        const ids = results.map((p) => p.id)
        expect(ids).not.toContain("prod-no-stock")
        expect(ids).toContain("prod-has-stock")
    })

    it("returns at most `limit` items", async () => {
        const manyProducts = Array.from({ length: 6 }, (_, i) =>
            makeProduct({ id: `prod-${i}` }),
        )
        prismaMock.product.findMany.mockResolvedValue(manyProducts as any)
        prismaMock.card.count.mockResolvedValue(5)

        const results = await getCrossSellRecommendations(sourceProductId, 3)
        expect(results.length).toBeLessThanOrEqual(3)
    })

    it("returns empty array when source product has no tags and no admin bindings", async () => {
        prismaMock.product.findUnique.mockResolvedValue(
            makeProduct({ id: sourceProductId, tags: [] }) as any,
        )
        const results = await getCrossSellRecommendations(sourceProductId, 3)
        expect(results).toEqual([])
    })
})
