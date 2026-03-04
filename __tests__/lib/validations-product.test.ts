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

    it("accepts valid secretCode", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "1",
            isActive: true,
            secretCode: "mysecret",
        })
        expect(result.success).toBe(true)
    })

    it("accepts empty secretCode", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "1",
            isActive: true,
            secretCode: "",
        })
        expect(result.success).toBe(true)
    })

    it("rejects secretCode longer than 64 characters", () => {
        const result = productFormSchema.safeParse({
            name: "Test",
            slug: "test",
            price: "10",
            maxQuantity: "1",
            isActive: true,
            secretCode: "a".repeat(65),
        })
        expect(result.success).toBe(false)
    })
})

describe("createProductSchema", () => {
    it("accepts secretCode", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
            secretCode: "code123",
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.secretCode).toBe("code123")
        }
    })

    it("accepts null secretCode", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
            secretCode: null,
        })
        expect(result.success).toBe(true)
    })

    it("rejects secretCode longer than 64 characters", () => {
        const result = createProductSchema.safeParse({
            name: "Test",
            slug: "test",
            price: 99,
            secretCode: "a".repeat(65),
        })
        expect(result.success).toBe(false)
    })
})

describe("updateProductSchema", () => {
    it("accepts secretCode update", () => {
        const result = updateProductSchema.safeParse({
            secretCode: "newcode",
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.secretCode).toBe("newcode")
        }
    })

    it("accepts null secretCode to clear", () => {
        const result = updateProductSchema.safeParse({
            secretCode: null,
        })
        expect(result.success).toBe(true)
    })
})
