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
