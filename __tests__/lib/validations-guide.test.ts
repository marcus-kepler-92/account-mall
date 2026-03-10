/**
 * Unit tests for lib/validations/guide schema.
 */

import { createGuideSchema, updateGuideSchema } from "@/lib/validations/guide"

describe("createGuideSchema", () => {
    it("accepts valid minimal data (title only)", () => {
        const result = createGuideSchema.safeParse({ title: "Guide 1" })
        expect(result.success).toBe(true)
    })

    it("rejects empty title", () => {
        const result = createGuideSchema.safeParse({ title: "" })
        expect(result.success).toBe(false)
    })

    it("rejects title longer than 200", () => {
        const result = createGuideSchema.safeParse({
            title: "a".repeat(201),
        })
        expect(result.success).toBe(false)
    })

    it("accepts title with 200 chars", () => {
        const result = createGuideSchema.safeParse({
            title: "a".repeat(200),
        })
        expect(result.success).toBe(true)
    })

    it("accepts optional content", () => {
        const result = createGuideSchema.safeParse({
            title: "G",
            content: "## Markdown",
        })
        expect(result.success).toBe(true)
    })

    it("rejects content longer than 50000", () => {
        const result = createGuideSchema.safeParse({
            title: "G",
            content: "x".repeat(50001),
        })
        expect(result.success).toBe(false)
    })

    it("accepts status DRAFT and PUBLISHED", () => {
        expect(createGuideSchema.safeParse({ title: "G", status: "DRAFT" }).success).toBe(true)
        expect(createGuideSchema.safeParse({ title: "G", status: "PUBLISHED" }).success).toBe(true)
    })

    it("rejects invalid status", () => {
        const result = createGuideSchema.safeParse({
            title: "G",
            status: "INVALID",
        })
        expect(result.success).toBe(false)
    })

    it("accepts sortOrder in range", () => {
        expect(createGuideSchema.safeParse({ title: "G", sortOrder: -1000 }).success).toBe(true)
        expect(createGuideSchema.safeParse({ title: "G", sortOrder: 10000 }).success).toBe(true)
    })

    it("rejects sortOrder out of range", () => {
        expect(createGuideSchema.safeParse({ title: "G", sortOrder: -1001 }).success).toBe(false)
        expect(createGuideSchema.safeParse({ title: "G", sortOrder: 10001 }).success).toBe(false)
    })

    it("accepts optional tagId", () => {
        const result = createGuideSchema.safeParse({
            title: "G",
            tagId: "tag_cuid_123",
        })
        expect(result.success).toBe(true)
    })

    it("accepts null tagId", () => {
        const result = createGuideSchema.safeParse({
            title: "G",
            tagId: null,
        })
        expect(result.success).toBe(true)
    })
})

describe("updateGuideSchema", () => {
    it("accepts partial update (title only)", () => {
        const result = updateGuideSchema.safeParse({ title: "Updated" })
        expect(result.success).toBe(true)
    })

    it("rejects empty title when provided", () => {
        const result = updateGuideSchema.safeParse({ title: "" })
        expect(result.success).toBe(false)
    })

    it("accepts empty object (all optional)", () => {
        const result = updateGuideSchema.safeParse({})
        expect(result.success).toBe(true)
    })
})
