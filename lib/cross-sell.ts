import { prisma } from "@/lib/prisma"
import { ProductStatus, CardStatus } from "@prisma/client"
import type { ProductCardData } from "@/app/components/product-card"
import { verifyCsToken, generateCsToken } from "@/lib/cross-sell-token"

/** Default cross-sell settings used when no DB row exists */
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
            // MANUAL products are excluded from cross-sell — they have no card
            // inventory and require manual fulfillment, so they don't fit the
            // post-purchase one-click upsell model (would also make the
            // CrossSellUsage one-time-use semantics ambiguous if the buyer
            // never gets fulfilled).
            if (product.productType === "MANUAL") return null
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

/**
 * Returns the set of product IDs eligible as cross-sell targets for a given
 * source product.
 *
 * Single source of truth: this is now a thin projection of
 * getCrossSellRecommendations. Sharing the candidate pool guarantees the
 * recommendation strip (订单成功页) and the eligibility check (resolver) can
 * never drift — anything shown as a discounted recommendation will be honored
 * downstream, and anything the resolver honors is exactly what the strip
 * could show. The earlier two-algorithm design silently selected different
 * tag-matched fallbacks when stock filtering kicked in.
 */
export async function getEligibleTargetIds(
    sourceProductId: string,
    limit = 3,
): Promise<Set<string>> {
    const recs = await getCrossSellRecommendations(sourceProductId, limit)
    return new Set(recs.map((r) => r.id))
}

type CrossSellSession = {
    sourceOrderId: string
    eligibleIds: Set<string>
    discountPercent: number
}

/**
 * Resolve a cs token to its session: the named source order, its eligible
 * cross-sell target set, and the active discount percent.
 *
 * Industry-standard post-purchase upsell model — one cs token represents
 * exactly one source order's limited-time recommendation window. No cross-
 * order session merging (the Shopify/AfterSell/ReConvert ecosystem doesn't
 * do that either); each new completed order spawns its own independent
 * window. This keeps the model predictable and matches the psychological
 * scarcity that drives upsell conversion.
 *
 * Returns null on any short-circuit:
 *   - missing / malformed / expired token
 *   - source order missing or not COMPLETED
 *   - cross-sell globally disabled or percent ≤ 0
 *   - paidAt + TTL elapsed (defense-in-depth alongside the token's own exp)
 */
async function resolveCrossSellSession(
    csToken: string | null | undefined,
): Promise<CrossSellSession | null> {
    if (!csToken) return null
    const verified = verifyCsToken(csToken)
    if (!verified.valid || !verified.payload) return null
    const { sourceOrderId } = verified.payload

    const [sourceOrder, setting] = await Promise.all([
        prisma.order.findUnique({
            where: { id: sourceOrderId },
            select: { id: true, status: true, productId: true, paidAt: true },
        }),
        getCrossSellSetting(),
    ])
    if (!sourceOrder || sourceOrder.status !== "COMPLETED") return null
    if (!setting.enabled || setting.discountPercent <= 0) return null

    // Belt-and-suspenders: enforce TTL from paidAt at the data layer too,
    // independent of the token's exp. Defends against signing-key rotation
    // / misconfigured TTL drift between token issue and consumption.
    if (sourceOrder.paidAt) {
        const expiresAt = sourceOrder.paidAt.getTime() + setting.ttlMinutes * 60_000
        if (Date.now() > expiresAt) return null
    }

    const eligibleIds = await getEligibleTargetIds(sourceOrder.productId)
    return {
        sourceOrderId,
        eligibleIds,
        discountPercent: setting.discountPercent,
    }
}

/**
 * Single source of truth for "given this cs token and this productId, what
 * discount (if any) applies?". All price-display and order-creation paths
 * call this — never duplicate the logic.
 *
 * Eligible targets are exactly those recommended for the cs token's source
 * order (admin bindings + tag-matched fallback + stock filter — same pool
 * the recommendation strip renders). One-time use ("重叠折扣不重叠") is
 * enforced per (sourceOrderId, productId) via CrossSellUsage's unique index.
 */
export async function resolveCrossSellDiscount(
    csToken: string | null | undefined,
    productId: string,
): Promise<number | null> {
    const session = await resolveCrossSellSession(csToken)
    if (!session) return null
    if (!session.eligibleIds.has(productId)) return null

    const used = await prisma.crossSellUsage.findUnique({
        where: {
            sourceOrderId_targetProductId: {
                sourceOrderId: session.sourceOrderId,
                targetProductId: productId,
            },
        },
        select: { id: true },
    })
    if (used) return null

    return session.discountPercent
}

/**
 * Bulk variant for product list pages. Returns a Map<productId, discountPercent>.
 * Missing keys mean "no discount". Empty map for any session short-circuit
 * (token invalid, source not COMPLETED, etc.) — callers treat empty as
 * "show original prices everywhere", not as an error.
 */
export async function resolveCrossSellDiscountsForProducts(
    csToken: string | null | undefined,
    productIds: string[],
): Promise<Map<string, number>> {
    const empty = new Map<string, number>()
    if (productIds.length === 0) return empty

    const session = await resolveCrossSellSession(csToken)
    if (!session) return empty

    const candidates = productIds.filter((id) => session.eligibleIds.has(id))
    if (candidates.length === 0) return empty

    const used = await prisma.crossSellUsage.findMany({
        where: {
            sourceOrderId: session.sourceOrderId,
            targetProductId: { in: candidates },
        },
        select: { targetProductId: true },
    })
    const usedSet = new Set(used.map((u) => u.targetProductId))

    const result = new Map<string, number>()
    for (const id of candidates) {
        if (!usedSet.has(id)) result.set(id, session.discountPercent)
    }
    return result
}

/**
 * Compute the absolute deadline (ms epoch) at which the cs session tied to
 * a given paidAt expires. Used by the order success page to drive the
 * countdown UI consistently with server-side TTL enforcement.
 */
export function getCsExpiryMs(paidAt: Date | null, ttlMinutes: number): number {
    if (!paidAt) return Date.now() + ttlMinutes * 60_000
    return paidAt.getTime() + ttlMinutes * 60_000
}

/**
 * Remaining ms until the absolute expiry. Server-side helper used to seed
 * the CrossSellSection's countdown so the first client render hydrates with
 * the same value the SSR rendered (no progress-bar flicker on hydration).
 *
 * Wrapped in a lib function — keeping Date.now() out of the page's server-
 * component render path placates react-hooks/purity, which flags it even
 * though server components run once per request.
 */
export function getCsRemainingMs(expiresAtMs: number): number {
    return Math.max(0, expiresAtMs - Date.now())
}

/**
 * Sign a cs token for a completed order, with TTL anchored to paidAt so the
 * session window doesn't reset when the user refreshes the success page.
 * Returns null if the window has already elapsed (no point signing a
 * pre-expired token) or the order isn't paid yet.
 *
 * Encapsulated here (instead of inlined in the success page) to keep Date.now()
 * out of the server component's render path — React's purity lint flags it,
 * even though server components run once per request.
 */
export function signCsTokenForOrder(
    orderId: string,
    paidAt: Date | null,
    ttlMinutes: number,
): string | null {
    if (!paidAt) return null
    const remainingMs = paidAt.getTime() + ttlMinutes * 60_000 - Date.now()
    if (remainingMs <= 0) return null
    return generateCsToken(orderId, remainingMs)
}
