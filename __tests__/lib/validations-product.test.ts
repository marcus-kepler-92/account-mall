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

    it("accepts optional commissionAmount", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "1",
            isActive: true,
            commissionAmount: "5.5",
        })
        expect(result.success).toBe(true)
    })
})

describe("createProductSchema", () => {
    it("accepts commissionAmount", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
            commissionAmount: 5,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.commissionAmount).toBe(5)
        }
    })

    it("accepts null commissionAmount", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
            commissionAmount: null,
        })
        expect(result.success).toBe(true)
    })
})

describe("updateProductSchema", () => {
    it("accepts commissionAmount update", () => {
        const result = updateProductSchema.safeParse({
            commissionAmount: 10,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.commissionAmount).toBe(10)
        }
    })

    it("accepts null commissionAmount to clear", () => {
        const result = updateProductSchema.safeParse({
            commissionAmount: null,
        })
        expect(result.success).toBe(true)
    })
})
