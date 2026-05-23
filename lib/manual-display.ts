// MANUAL product display helper.
//
// MANUAL products carry per-variant pricing — the product-level `price` field
// is meaningless (always 0). Buyer-side surfaces (detail page, sticky bottom
// bar, variant selector header) need a consistent way to derive:
//   - whether the product is MANUAL
//   - whether it is *unavailable* (MANUAL with zero active variants — a
//     misconfigured row that must not render a buy form)
//   - the price band across active variants (min / max)
//   - a formatted label suitable for headers: "¥9.90" or "¥9.90 起"
//
// All these used to be computed inline at the call site, which drifted between
// page.tsx and product-bottom-bar.tsx. Consolidate here so a single helper
// drives every MANUAL surface.

export type ManualDisplay = {
  isManual: boolean
  // MANUAL + zero active variants → product is ACTIVE in the DB but cannot
  // actually be sold. The detail page renders a "配置中" placeholder and
  // short-circuits before the order form.
  isUnavailable: boolean
  // Min/max price across active variants. null when the product is not MANUAL
  // or when there are no active variants with finite prices.
  priceMin: number | null
  priceMax: number | null
  // Pre-formatted label safe to drop into headers. null when there is no
  // price band to display (non-MANUAL or unavailable).
  //   priceMin === priceMax → "¥9.90"
  //   priceMin !== priceMax → "¥9.90 起"
  priceLabel: string | null
}

type ProductInput = {
  productType: string
}

type VariantInput = {
  // Decimal-like (Prisma) | number | string. We call Number(...) on whatever
  // the caller passes after first coercing Decimals via toString.
  price: { toString(): string } | number | string
  isActive: boolean
}

function toNumber(price: VariantInput["price"]): number {
  if (typeof price === "number") return price
  if (typeof price === "string") return Number(price)
  return Number(price.toString())
}

export function computeManualDisplay(
  product: ProductInput,
  variants: VariantInput[],
): ManualDisplay {
  const isManual = product.productType === "MANUAL"
  if (!isManual) {
    return {
      isManual: false,
      isUnavailable: false,
      priceMin: null,
      priceMax: null,
      priceLabel: null,
    }
  }

  const activeNumericPrices = variants
    .filter((v) => v.isActive)
    .map((v) => toNumber(v.price))
    .filter((n) => Number.isFinite(n))

  const isUnavailable = activeNumericPrices.length === 0

  if (isUnavailable) {
    return {
      isManual: true,
      isUnavailable: true,
      priceMin: null,
      priceMax: null,
      priceLabel: null,
    }
  }

  const priceMin = Math.min(...activeNumericPrices)
  const priceMax = Math.max(...activeNumericPrices)
  const priceLabel =
    priceMin === priceMax
      ? `¥${priceMin.toFixed(2)}`
      : `¥${priceMin.toFixed(2)} 起`

  return {
    isManual: true,
    isUnavailable: false,
    priceMin,
    priceMax,
    priceLabel,
  }
}
