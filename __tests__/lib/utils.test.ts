/**
 * Unit tests for lib/utils: cn and generateSlug.
 */

import { cn, generateSlug } from "@/lib/utils"

describe("cn", () => {
    it("merges class names", () => {
        expect(cn("foo", "bar")).toBe("foo bar")
    })

    it("handles conditional classes", () => {
        expect(cn("base", false && "hidden", "visible")).toContain("visible")
    })
})

describe("generateSlug", () => {
    it("lowercases and replaces spaces with hyphens", () => {
        expect(generateSlug("My Product Name")).toBe("my-product-name")
    })

    it("trims and collapses multiple hyphens", () => {
        expect(generateSlug("  hello   world  ")).toBe("hello-world")
    })

    it("removes non-word characters", () => {
        expect(generateSlug("Test! @Product#")).toBe("test-product")
    })
})
