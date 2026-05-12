import { prisma } from "@/lib/prisma"
import { ProductStatus, CardStatus } from "@prisma/client"
import type { ProductCardData } from "@/app/components/product-card"

/** Default cross-sell settings used when no DB row exists */
const DEFAULTS = {
    enabled: true,
    discountPercent: 10,
    ttlMinutes: 10,
} as const

/**
 * Returns the CrossSellSetting singleton, or sensible defaults if row doesn't exist.
 * Never writes to the DB (avoids cold-start race conditions).
 */
export async function getCrossSellSetting(): Promise<{
    enabled: boolean
    discountPercent: number
    ttlMinutes: number
}> {
    const row = await prisma.crossSellSetting.findUnique({
        where: { id: "singleton" },
    })
    if (!row) return { ...DEFAULTS }
    return {
        enabled: row.enabled,
        discountPercent: Number(row.discountPercent),
        ttlMinutes: row.ttlMinutes,
    }
}

/**
 * Returns up to `limit` cross-sell recommendations for the given sourceProductId.
 *
 * Algorithm:
 *   1. Fetch admin-configured targets from ProductCrossSell (ordered by sortOrder asc)
 *   2. If fewer than `limit` found: fetch additional products from same tags as source,
 *      ordered by sortOrder asc, excluding already-included products and the source itself
 *   3. Filter combined list: keep only ACTIVE products with at least 1 UNSOLD card
 *   4. Return first `limit` items
 */
export async function getCrossSellRecommendations(
    sourceProductId: string,
    limit = 3,
): Promise<ProductCardData[]> {
    // Step 1: admin-bound targets
    const adminBindings = await prisma.productCrossSell.findMany({
        where: { sourceProductId },
        orderBy: { sortOrder: "asc" },
        include: {
            target: {
                include: {
                    tags: { select: { id: true, name: true, slug: true } },
                },
            },
        },
    })

    const adminTargets = adminBindings.map((b) => b.target)
    const includedIds = new Set<string>(adminTargets.map((p) => p.id))
    includedIds.add(sourceProductId)

    let candidates = [...adminTargets]

    // Step 2: fill from tag-matching products if needed
    if (candidates.length < limit) {
        const sourceProduct = await prisma.product.findUnique({
            where: { id: sourceProductId },
            include: { tags: { select: { id: true } } },
        })

        const tagIds = sourceProduct?.tags.map((t) => t.id) ?? []

        if (tagIds.length > 0) {
            const tagMatched = await prisma.product.findMany({
                where: {
                    tags: { some: { id: { in: tagIds } } },
                    id: { notIn: Array.from(includedIds) },
                },
                orderBy: { sortOrder: "asc" },
                include: {
                    tags: { select: { id: true, name: true, slug: true } },
                },
            })
            candidates = [...candidates, ...tagMatched]
        }
    }

    // Deduplicate and exclude the source product (defensive guard for mocked/edge-case results)
    const seen = new Set<string>()
    const deduped = candidates.filter((p) => {
        if (p.id === sourceProductId || seen.has(p.id)) return false
        seen.add(p.id)
        return true
    })

    // Step 3: filter for ACTIVE products with at least 1 UNSOLD card
    const withStock = await Promise.all(
        deduped.map(async (product) => {
            if (product.status !== ProductStatus.ACTIVE) return null
            const unsoldCount = await prisma.card.count({
                where: { productId: product.id, status: CardStatus.UNSOLD },
            })
            if (product.productType === "AUTO_FETCH") {
                // AUTO_FETCH products are always considered in-stock
                return product
            }
            if (unsoldCount === 0) return null
            return product
        }),
    )

    const filtered = withStock.filter((p): p is NonNullable<typeof p> => p !== null)

    // Step 4: return first `limit` items shaped as ProductCardData
    return filtered.slice(0, limit).map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? null,
        summary: product.summary ?? null,
        image: product.image ?? null,
        price: Number(product.price),
        stock: 0, // stock count not needed here — caller can fetch if required
        productType: (product.productType ?? "NORMAL") as "NORMAL" | "AUTO_FETCH",
        tags: product.tags,
    }))
}
