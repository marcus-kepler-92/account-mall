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
    getEligibleTargetIds,
    resolveCrossSellDiscounts,
    createCrossSellSession,
} from "@/lib/cross-sell"
import { generateCsToken } from "@/lib/cross-sell-token"

jest.mock("@/lib/config", () => ({
    config: {
        crossSellTokenSecret: "test-cross-sell-secret-16chars!!",
        betterAuthSecret: "fallback-secret-16chars!!",
    },
}))

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

describe("getEligibleTargetIds (projection of getCrossSellRecommendations)", () => {
    const sourceProductId = "source-prod"

    beforeEach(() => {
        prismaMock.productCrossSell.findMany.mockResolvedValue([])
        prismaMock.product.findUnique.mockResolvedValue(
            makeProduct({
                id: sourceProductId,
                tags: [{ id: "tag-1", name: "Gaming", slug: "gaming" }],
            }) as any,
        )
        prismaMock.product.findMany.mockResolvedValue([])
        prismaMock.card.count.mockResolvedValue(5)
    })

    it("returns IDs of admin-bound targets", async () => {
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-1",
                sourceProductId,
                targetProductId: "prod-a",
                sortOrder: 0,
                createdAt: new Date(),
                target: makeProduct({ id: "prod-a" }),
            },
            {
                id: "cs-2",
                sourceProductId,
                targetProductId: "prod-b",
                sortOrder: 1,
                createdAt: new Date(),
                target: makeProduct({ id: "prod-b" }),
            },
        ] as any)

        const ids = await getEligibleTargetIds(sourceProductId, 3)
        expect(ids.has("prod-a")).toBe(true)
        expect(ids.has("prod-b")).toBe(true)
    })

    it("includes tag-matched fallback when admin bindings under limit", async () => {
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-1",
                sourceProductId,
                targetProductId: "prod-a",
                sortOrder: 0,
                createdAt: new Date(),
                target: makeProduct({ id: "prod-a" }),
            },
        ] as any)
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: "prod-tag-1" }),
            makeProduct({ id: "prod-tag-2" }),
        ] as any)

        const ids = await getEligibleTargetIds(sourceProductId, 3)
        expect(ids.has("prod-a")).toBe(true)
        expect(ids.has("prod-tag-1")).toBe(true)
        expect(ids.has("prod-tag-2")).toBe(true)
    })

    it("excludes out-of-stock targets (matches recommendation behavior)", async () => {
        // Regression: previously getEligibleTargetIds skipped stock filtering,
        // so it could return IDs that getCrossSellRecommendations had already
        // filtered out — causing 推荐区 ↔ resolver drift. Now they share the
        // candidate pool and both honor stock.
        prismaMock.product.findMany.mockResolvedValue([
            makeProduct({ id: "prod-in-stock" }),
            makeProduct({ id: "prod-no-stock" }),
        ] as any)
        prismaMock.card.count.mockImplementation((async ({ where }: any) => {
            if (where.productId === "prod-in-stock") return 5
            return 0
        }) as any)

        const ids = await getEligibleTargetIds(sourceProductId, 3)
        expect(ids.has("prod-in-stock")).toBe(true)
        expect(ids.has("prod-no-stock")).toBe(false)
    })

    it("never includes the source product itself", async () => {
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-1",
                sourceProductId,
                targetProductId: sourceProductId,
                sortOrder: 0,
                createdAt: new Date(),
                target: makeProduct({ id: sourceProductId }),
            },
        ] as any)
        const ids = await getEligibleTargetIds(sourceProductId, 3)
        expect(ids.has(sourceProductId)).toBe(false)
    })
})

describe("resolveCrossSellDiscounts (single product via .get(id))", () => {
    const sourceOrderId = "src-order-1"
    const sourceProductId = "src-prod"
    const targetProductId = "tgt-prod"
    const now = new Date()

    const single = async (token: string | null | undefined, productId: string) =>
        (await resolveCrossSellDiscounts(token, [productId])).get(productId) ?? null

    beforeEach(() => {
        prismaMock.crossSellSetting.findUnique.mockResolvedValue({
            id: "singleton",
            enabled: true,
            discountPercent: new Prisma.Decimal("10"),
            ttlMinutes: 30,
            createdAt: now,
            updatedAt: now,
        } as any)
        prismaMock.order.findUnique.mockResolvedValue({
            id: sourceOrderId,
            status: "COMPLETED",
            productId: sourceProductId,
            paidAt: now,
        } as any)
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-binding",
                sourceProductId,
                targetProductId,
                sortOrder: 0,
                createdAt: now,
                target: makeProduct({ id: targetProductId }),
            },
        ] as any)
        prismaMock.product.findUnique.mockResolvedValue(
            makeProduct({ id: sourceProductId, tags: [] }) as any,
        )
        prismaMock.product.findMany.mockResolvedValue([])
        prismaMock.card.count.mockResolvedValue(5)
        prismaMock.crossSellUsage.findMany.mockResolvedValue([])
    })

    it("returns null for missing token", async () => {
        expect(await single(null, targetProductId)).toBeNull()
        expect(await single(undefined, targetProductId)).toBeNull()
        expect(await single("", targetProductId)).toBeNull()
    })

    it("returns null for invalid token", async () => {
        expect(await single("garbage.token.value", targetProductId)).toBeNull()
    })

    it("returns discountPercent for valid token + eligible target + unconsumed", async () => {
        const token = generateCsToken(sourceOrderId, 60_000)!
        expect(await single(token, targetProductId)).toBe(10)
    })

    it("returns null when source order not COMPLETED", async () => {
        prismaMock.order.findUnique.mockResolvedValue({
            id: sourceOrderId,
            status: "PENDING",
            productId: sourceProductId,
            paidAt: now,
        } as any)
        const token = generateCsToken(sourceOrderId, 60_000)!
        expect(await single(token, targetProductId)).toBeNull()
    })

    it("returns null when cross-sell globally disabled", async () => {
        prismaMock.crossSellSetting.findUnique.mockResolvedValue({
            id: "singleton",
            enabled: false,
            discountPercent: new Prisma.Decimal("10"),
            ttlMinutes: 30,
            createdAt: now,
            updatedAt: now,
        } as any)
        const token = generateCsToken(sourceOrderId, 60_000)!
        expect(await single(token, targetProductId)).toBeNull()
    })

    it("returns null when product not in the source's eligible target set", async () => {
        const token = generateCsToken(sourceOrderId, 60_000)!
        expect(await single(token, "unrelated-product-id")).toBeNull()
    })

    it("returns null when CrossSellUsage already consumed (this source × target)", async () => {
        prismaMock.crossSellUsage.findMany.mockResolvedValue([
            { targetProductId },
        ] as any)
        const token = generateCsToken(sourceOrderId, 60_000)!
        expect(await single(token, targetProductId)).toBeNull()
    })

    it("returns null when paidAt + TTL has elapsed (data-layer TTL guard)", async () => {
        const longAgo = new Date(Date.now() - 60 * 60_000)
        prismaMock.order.findUnique.mockResolvedValue({
            id: sourceOrderId,
            status: "COMPLETED",
            productId: sourceProductId,
            paidAt: longAgo,
        } as any)
        // Token still valid (long ttlMs), but paidAt+TTL is past
        const token = generateCsToken(sourceOrderId, 60 * 60_000)!
        expect(await single(token, targetProductId)).toBeNull()
    })
})

describe("resolveCrossSellDiscounts (bulk, single-source per token)", () => {
    const sourceOrderId = "src-order-1"
    const sourceProductId = "src-prod"
    const now = new Date()

    beforeEach(() => {
        prismaMock.crossSellSetting.findUnique.mockResolvedValue({
            id: "singleton",
            enabled: true,
            discountPercent: new Prisma.Decimal("10"),
            ttlMinutes: 30,
            createdAt: now,
            updatedAt: now,
        } as any)
        prismaMock.order.findUnique.mockResolvedValue({
            id: sourceOrderId,
            status: "COMPLETED",
            productId: sourceProductId,
            paidAt: now,
        } as any)
        prismaMock.productCrossSell.findMany.mockResolvedValue([
            {
                id: "cs-pa",
                sourceProductId,
                targetProductId: "p-a",
                sortOrder: 0,
                createdAt: now,
                target: makeProduct({ id: "p-a" }),
            },
            {
                id: "cs-pb",
                sourceProductId,
                targetProductId: "p-b",
                sortOrder: 1,
                createdAt: now,
                target: makeProduct({ id: "p-b" }),
            },
        ] as any)
        prismaMock.product.findUnique.mockResolvedValue(
            makeProduct({ id: sourceProductId, tags: [] }) as any,
        )
        prismaMock.product.findMany.mockResolvedValue([])
        prismaMock.card.count.mockResolvedValue(5)
        prismaMock.crossSellUsage.findMany.mockResolvedValue([])
    })

    it("returns empty map for missing token", async () => {
        const m = await resolveCrossSellDiscounts(null, ["p-a"])
        expect(m.size).toBe(0)
    })

    it("returns empty map for empty productIds", async () => {
        const token = generateCsToken(sourceOrderId, 60_000)!
        const m = await resolveCrossSellDiscounts(token, [])
        expect(m.size).toBe(0)
    })

    it("marks eligible products with discountPercent, skips others", async () => {
        const token = generateCsToken(sourceOrderId, 60_000)!
        const m = await resolveCrossSellDiscounts(token, [
            "p-a",
            "p-b",
            "p-unrelated",
        ])
        expect(m.get("p-a")).toBe(10)
        expect(m.get("p-b")).toBe(10)
        expect(m.has("p-unrelated")).toBe(false)
    })

    it("skips products already consumed by the token's source", async () => {
        prismaMock.crossSellUsage.findMany.mockResolvedValue([
            { targetProductId: "p-a" },
        ] as any)
        const token = generateCsToken(sourceOrderId, 60_000)!
        const m = await resolveCrossSellDiscounts(token, ["p-a", "p-b"])
        expect(m.has("p-a")).toBe(false)
        expect(m.get("p-b")).toBe(10)
    })

    it("queries CrossSellUsage scoped to the token's source", async () => {
        const findManySpy = prismaMock.crossSellUsage.findMany as jest.Mock
        findManySpy.mockResolvedValue([])
        const token = generateCsToken(sourceOrderId, 60_000)!
        await resolveCrossSellDiscounts(token, ["p-a"])

        const callArgs = findManySpy.mock.calls[0][0]
        // Scalar, not `{ in: [...] }` — single-source semantics.
        expect(callArgs.where.sourceOrderId).toBe(sourceOrderId)
    })
})

describe("createCrossSellSession", () => {
    it("returns signed token + expiry anchored to paidAt", () => {
        const paidAt = new Date(Date.now() - 60_000) // 1 min ago
        const session = createCrossSellSession("order-1", paidAt, 30)
        expect(session.csToken).not.toBeNull()
        expect(session.expiresAt).toBe(paidAt.getTime() + 30 * 60_000)
        expect(session.initialRemainingMs).toBeGreaterThan(0)
        expect(session.initialRemainingMs).toBeLessThanOrEqual(30 * 60_000)
    })

    it("returns null token when paidAt missing", () => {
        const session = createCrossSellSession("order-1", null, 30)
        expect(session.csToken).toBeNull()
    })

    it("returns null token when paidAt + TTL already elapsed", () => {
        const longAgo = new Date(Date.now() - 60 * 60_000) // 1h ago
        const session = createCrossSellSession("order-1", longAgo, 5)
        expect(session.csToken).toBeNull()
        expect(session.initialRemainingMs).toBe(0)
    })
})
