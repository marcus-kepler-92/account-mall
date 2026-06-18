import type { Prisma } from "@prisma/client"
import { descriptionToPlainText } from "@/lib/description"

// Product slugs are stored as `{cuid}-{descriptive}` — the cuid is the stable
// prefix, while the descriptive tail can be renamed by an admin. When a
// requested slug no longer resolves, recover the cuid prefix so the product can
// be looked up by id and the request 308-redirected to the live canonical slug
// (preserving ranking equity instead of 404-ing). Returns null when the prefix
// is not a plausible cuid, so plain non-cuid slugs fall through to a normal 404.
export function extractProductIdPrefix(slug: string): string | null {
  const prefix = slug.split("-", 1)[0]
  return /^c[a-z0-9]{20,}$/.test(prefix) ? prefix : null
}

// Build the schema.org offer node for a product's structured data.
//
// NORMAL / AUTO_FETCH products have a single meaningful `product.price`, so they
// emit a plain Offer. MANUAL products price per-variant (the product-level price
// is always 0), and the page shows a "¥min 起" band — emitting a single Offer
// there would publish a price of 0, contradicting the visible price. Google
// forbids ProductGroup-less variants but supports AggregateOffer for a price
// band, so MANUAL products with active variants emit an AggregateOffer whose
// lowPrice/highPrice mirror the visible band. The caller merges shared fields
// (availability, shippingDetails, return policy, etc.) onto the returned object.
export function buildProductOfferPricing(args: {
  isManual: boolean
  priceMin: number | null
  priceMax: number | null
  fixedPrice: number
  activeVariantCount: number
}): Record<string, unknown> {
  if (args.isManual && args.priceMin != null) {
    const offer: Record<string, unknown> = {
      "@type": "AggregateOffer",
      priceCurrency: "CNY",
      lowPrice: args.priceMin,
    }
    if (args.priceMax != null && args.priceMax !== args.priceMin) {
      offer.highPrice = args.priceMax
    }
    if (args.activeVariantCount > 0) {
      offer.offerCount = args.activeVariantCount
    }
    return offer
  }
  return {
    "@type": "Offer",
    priceCurrency: "CNY",
    price: args.fixedPrice,
  }
}

// Shared meta + structured-data description. Prefers the admin-authored summary
// (keyword-rich, capped at 300 chars in the schema), then the rich description,
// then a name + price stub. Truncated to 160 chars for SERP snippets.
export function buildProductDescription(p: {
  summary: string | null
  description: string | null
  name: string
  price: Prisma.Decimal | number
}): string {
  const summary = p.summary?.trim()
  if (summary) return summary.slice(0, 160)
  if (p.description) return descriptionToPlainText(p.description, 160)
  return `${p.name} - ¥${Number(p.price).toFixed(2)}`
}
