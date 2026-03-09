/**
 * Builds the canonical product detail path for redirect when slug mismatches.
 * Preserves promoCode in query when provided.
 */
export function buildProductDetailRedirectPath(
    productId: string,
    canonicalSlug: string,
    promoCode?: string | null
): string {
    const path = `/products/${productId}-${canonicalSlug}`
    if (!promoCode?.trim()) return path
    const q = new URLSearchParams()
    q.set("promoCode", promoCode.trim())
    return `${path}?${q.toString()}`
}
