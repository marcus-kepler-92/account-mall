import { prisma } from "@/lib/prisma"
import { ProductStatus, CardStatus } from "@prisma/client"
import type { ProductCardData } from "@/app/components/product-card"
import { verifyCsToken, generateCsToken } from "@/lib/cross-sell-token"

const DEFAULTS = {
    enabled: true,
    discountPercent: 10,
    ttlMinutes: 5,
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

    const seen = new Set<string>()
    const deduped = candidates.filter((p) => {
        if (p.id === sourceProductId || seen.has(p.id)) return false
        seen.add(p.id)
        return true
    })

    const withStock = await Promise.all(
        deduped.map(async (product) => {
            if (product.status !== ProductStatus.ACTIVE) return null
            // MANUAL products are excluded from cross-sell — they have no card
            // inventory and require manual fulfillment, so they don't fit the
            // post-purchase one-click upsell model (would also make the
            // CrossSellUsage one-time-use semantics ambiguous if the buyer
            // never gets fulfilled).
            if (product.productType === "MANUAL") return null
            if (product.productType === "AUTO_FETCH") return product
            const unsoldCount = await prisma.card.count({
                where: { productId: product.id, status: CardStatus.UNSOLD },
            })
            if (unsoldCount === 0) return null
            return product
        }),
    )

    const filtered = withStock.filter((p): p is NonNullable<typeof p> => p !== null)

    return filtered.slice(0, limit).map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? null,
        summary: product.summary ?? null,
        image: product.image ?? null,
        price: Number(product.price),
        stock: 0,
        productType: (product.productType ?? "NORMAL") as "NORMAL" | "AUTO_FETCH",
        tags: product.tags,
    }))
}

/**
 * Eligible target product IDs for a given source product. Thin projection of
 * getCrossSellRecommendations so the recommendation strip (订单成功页) and
 * the discount resolver share one candidate pool — anything shown discounted
 * is honored downstream, and vice versa.
 */
export async function getEligibleTargetIds(
    sourceProductId: string,
    limit = 3,
): Promise<Set<string>> {
    const recs = await getCrossSellRecommendations(sourceProductId, limit)
    return new Set(recs.map((r) => r.id))
}

/**
 * Per-product cross-sell discount for the current cs session. Returns
 * Map<productId, discountPercent>; missing keys mean "no discount applies".
 *
 * Industry-standard post-purchase upsell model — one cs token represents
 * exactly one source order's limited-time recommendation window. No cross-
 * order session merging; each new completed order spawns its own independent
 * window. Returns an empty map for any short-circuit:
 *   - missing / malformed / expired token
 *   - source order missing or not COMPLETED
 *   - cross-sell globally disabled or percent ≤ 0
 *   - paidAt + TTL elapsed (defense-in-depth alongside the token's own exp)
 *   - none of the requested productIds are eligible
 *
 * One-time use is enforced per (sourceOrderId, productId) via CrossSellUsage.
 */
export async function resolveCrossSellDiscounts(
    csToken: string | null | undefined,
    productIds: string[],
): Promise<Map<string, number>> {
    const empty = new Map<string, number>()
    if (!csToken || productIds.length === 0) return empty

    const verified = verifyCsToken(csToken)
    if (!verified.valid || !verified.payload) return empty
    const { sourceOrderId } = verified.payload

    const [sourceOrder, setting] = await Promise.all([
        prisma.order.findUnique({
            where: { id: sourceOrderId },
            select: { id: true, status: true, productId: true, paidAt: true },
        }),
        getCrossSellSetting(),
    ])
    if (!sourceOrder || sourceOrder.status !== "COMPLETED") return empty
    if (!setting.enabled || setting.discountPercent <= 0) return empty

    // Belt-and-suspenders: enforce TTL from paidAt at the data layer too,
    // independent of the token's exp. Defends against signing-key rotation
    // or misconfigured TTL drift between token issue and consumption.
    if (sourceOrder.paidAt) {
        const expiresAt = sourceOrder.paidAt.getTime() + setting.ttlMinutes * 60_000
        if (Date.now() > expiresAt) return empty
    }

    const eligibleIds = await getEligibleTargetIds(sourceOrder.productId)
    const candidates = productIds.filter((id) => eligibleIds.has(id))
    if (candidates.length === 0) return empty

    const used = await prisma.crossSellUsage.findMany({
        where: {
            sourceOrderId,
            targetProductId: { in: candidates },
        },
        select: { targetProductId: true },
    })
    const usedSet = new Set(used.map((u) => u.targetProductId))

    const result = new Map<string, number>()
    for (const id of candidates) {
        if (!usedSet.has(id)) result.set(id, setting.discountPercent)
    }
    return result
}

/**
 * Build the cs session for a completed order's success page: signs a fresh
 * token (null past the TTL window) and returns the absolute expiry + initial
 * remaining ms used to seed the countdown UI.
 *
 * Combined into one helper so Date.now() lives in lib code, not in the page's
 * server-component render path (placates react-hooks/purity lint).
 */
export function createCrossSellSession(
    orderId: string,
    paidAt: Date | null,
    ttlMinutes: number,
): { csToken: string | null; expiresAt: number; initialRemainingMs: number } {
    const anchorMs = paidAt?.getTime() ?? Date.now()
    const expiresAt = anchorMs + ttlMinutes * 60_000
    const initialRemainingMs = Math.max(0, expiresAt - Date.now())
    const csToken =
        paidAt && initialRemainingMs > 0
            ? generateCsToken(orderId, initialRemainingMs)
            : null
    return { csToken, expiresAt, initialRemainingMs }
}
