import {
  extractProductIdPrefix,
  buildProductDescription,
  buildProductOfferPricing,
} from "@/lib/product-seo"

describe("extractProductIdPrefix", () => {
  it("extracts the cuid prefix from a `{cuid}-{descriptive}` slug", () => {
    expect(
      extractProductIdPrefix("cmmjblafe0000l804swz7nyo3-apple-id-japan"),
    ).toBe("cmmjblafe0000l804swz7nyo3")
  })

  it("extracts the cuid even when the descriptive tail has many dashes", () => {
    expect(
      extractProductIdPrefix("cmm7ufjp40001l804h06xbnm2-apple-id-us-icloud"),
    ).toBe("cmm7ufjp40001l804h06xbnm2")
  })

  it("returns the cuid when the slug is just the bare id", () => {
    expect(extractProductIdPrefix("cmmjblafe0000l804swz7nyo3")).toBe(
      "cmmjblafe0000l804swz7nyo3",
    )
  })

  it("returns null for a plain descriptive slug with no cuid prefix", () => {
    expect(extractProductIdPrefix("apple-id-japan")).toBeNull()
  })

  it("returns null for a short non-cuid first segment", () => {
    expect(extractProductIdPrefix("abc-123")).toBeNull()
  })

  it("returns null when the prefix does not start with 'c'", () => {
    expect(extractProductIdPrefix("xmmjblafe0000l804swz7nyo3-foo")).toBeNull()
  })
})

describe("buildProductDescription", () => {
  const base = { name: "日本 Apple ID", price: 9.9 }

  it("prefers the admin summary, capped at 160 chars", () => {
    const summary = "日".repeat(300)
    const out = buildProductDescription({
      ...base,
      summary,
      description: "rich description",
    })
    expect(out).toBe("日".repeat(160))
    expect(out.length).toBe(160)
  })

  it("trims whitespace-only summaries and falls back to the description", () => {
    expect(
      buildProductDescription({
        ...base,
        summary: "   ",
        description: "fallback body",
      }),
    ).toBe("fallback body")
  })

  it("falls back to name + price when neither summary nor description exist", () => {
    expect(
      buildProductDescription({ ...base, summary: null, description: null }),
    ).toBe("日本 Apple ID - ¥9.90")
  })
})

describe("buildProductOfferPricing", () => {
  it("emits a plain Offer for non-MANUAL products", () => {
    expect(
      buildProductOfferPricing({
        isManual: false,
        priceMin: null,
        priceMax: null,
        fixedPrice: 12.5,
        activeVariantCount: 0,
      }),
    ).toEqual({ "@type": "Offer", priceCurrency: "CNY", price: 12.5 })
  })

  it("emits an AggregateOffer with low/high price for a MANUAL price band", () => {
    expect(
      buildProductOfferPricing({
        isManual: true,
        priceMin: 9.9,
        priceMax: 29.9,
        fixedPrice: 0,
        activeVariantCount: 3,
      }),
    ).toEqual({
      "@type": "AggregateOffer",
      priceCurrency: "CNY",
      lowPrice: 9.9,
      highPrice: 29.9,
      offerCount: 3,
    })
  })

  it("omits highPrice when MANUAL variants share a single price", () => {
    const offer = buildProductOfferPricing({
      isManual: true,
      priceMin: 9.9,
      priceMax: 9.9,
      fixedPrice: 0,
      activeVariantCount: 2,
    })
    expect(offer).not.toHaveProperty("highPrice")
    expect(offer).toMatchObject({
      "@type": "AggregateOffer",
      lowPrice: 9.9,
      offerCount: 2,
    })
  })

  it("falls back to a plain Offer when a MANUAL product has no priced variants", () => {
    // isUnavailable MANUAL rows surface priceMin === null; never publish ¥0 as a band.
    expect(
      buildProductOfferPricing({
        isManual: true,
        priceMin: null,
        priceMax: null,
        fixedPrice: 0,
        activeVariantCount: 0,
      }),
    ).toEqual({ "@type": "Offer", priceCurrency: "CNY", price: 0 })
  })
})
