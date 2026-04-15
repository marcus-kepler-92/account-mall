/**
 * Unit tests for lib/validations/product schema branches.
 */

import { productFormSchema, createProductSchema, updateProductSchema } from "@/lib/validations/product"

describe("productFormSchema", () => {
    it("accepts valid price string", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "29.99",
            maxQuantity: "10",
            isActive: true,
        })
        expect(result.success).toBe(true)
    })

    it("rejects price not greater than 0", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "0",
            maxQuantity: "1",
            isActive: true,
        })
        expect(result.success).toBe(false)
    })

    it("accepts empty maxQuantity (default)", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "",
            isActive: true,
        })
        expect(result.success).toBe(true)
    })

    it("rejects maxQuantity out of range", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "0",
            isActive: true,
        })
        expect(result.success).toBe(false)
    })

})

describe("createProductSchema", () => {
    it("accepts minimal product data", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
        })
        expect(result.success).toBe(true)
    })
})

describe("updateProductSchema", () => {
    it("accepts partial update", () => {
        const result = updateProductSchema.safeParse({
            price: 10,
        })
        expect(result.success).toBe(true)
    })
})

describe("productFormSchema — AUTO_FETCH voidlogins branch", () => {
    const base = {
        name: "T", slug: "t", price: "", maxQuantity: "", isActive: true,
        productType: "AUTO_FETCH" as const,
    }

    it("accepts voidlogins type with code only", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "voidlogins", voidloginsCode: "ABC" })
        expect(r.success).toBe(true)
    })

    it("accepts voidlogins type with code and password", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "voidlogins", voidloginsCode: "ABC", voidloginsPassword: "pass" })
        expect(r.success).toBe(true)
    })

    it("password is optional — empty string accepted", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "voidlogins", voidloginsCode: "ABC", voidloginsPassword: "" })
        expect(r.success).toBe(true)
    })

    it("rejects voidlogins type when code is missing", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "voidlogins", voidloginsCode: "" })
        expect(r.success).toBe(false)
        if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("voidloginsCode")
    })

    it("rejects voidlogins type when code is whitespace only", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "voidlogins", voidloginsCode: "   " })
        expect(r.success).toBe(false)
    })

    it("scrape type requires sourceUrl", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "scrape", sourceUrl: "" })
        expect(r.success).toBe(false)
        if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain("sourceUrl")
    })

    it("defaults to scrape behaviour when autoFetchType omitted", () => {
        const r = productFormSchema.safeParse({ ...base, sourceUrl: "" })
        expect(r.success).toBe(false)
    })

    it("scrape type with valid sourceUrl passes", () => {
        const r = productFormSchema.safeParse({ ...base, autoFetchType: "scrape", sourceUrl: "https://example.com/share" })
        expect(r.success).toBe(true)
    })
})

describe("purchaseLimitEnabled / purchaseLimitQuantity", () => {
  it("createProductSchema accepts purchaseLimitEnabled=true and quantity=2", () => {
    const result = createProductSchema.safeParse({
      name: "P",
      slug: "p",
      price: 10,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: 2,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.purchaseLimitEnabled).toBe(true)
      expect(result.data.purchaseLimitQuantity).toBe(2)
    }
  })

  it("createProductSchema rejects purchaseLimitQuantity=0", () => {
    const result = createProductSchema.safeParse({
      name: "P",
      slug: "p",
      price: 10,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: 0,
    })
    expect(result.success).toBe(false)
  })

  it("productFormSchema accepts purchaseLimitQuantity as string", () => {
    const result = productFormSchema.safeParse({
      name: "P",
      slug: "p",
      price: "10",
      maxQuantity: "5",
      isActive: true,
      purchaseLimitEnabled: true,
      purchaseLimitQuantity: "3",
    })
    expect(result.success).toBe(true)
  })
})
