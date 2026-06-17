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
