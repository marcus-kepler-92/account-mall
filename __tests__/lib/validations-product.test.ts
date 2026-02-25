/**
 * Unit tests for lib/validations/product schema branches.
 */

import { productFormSchema } from "@/lib/validations/product"

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
