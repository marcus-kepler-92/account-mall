/**
 * Unit tests for lib/utils: cn and generateSlug.
 */

import { cn, generateSlug, parseVoidloginsSourceUrl, buildVoidloginsSourceUrl } from "@/lib/utils"

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

describe("parseVoidloginsSourceUrl", () => {
    it("parses code-only URL", () => {
        expect(parseVoidloginsSourceUrl("voidlogins://CODE123")).toEqual({ code: "CODE123", password: "" })
    })

    it("parses code and password", () => {
        expect(parseVoidloginsSourceUrl("voidlogins://CODE/PASS")).toEqual({ code: "CODE", password: "PASS" })
    })

    it("returns null for non-voidlogins URL", () => {
        expect(parseVoidloginsSourceUrl("https://example.com")).toBeNull()
    })

    it("returns null for empty string", () => {
        expect(parseVoidloginsSourceUrl("")).toBeNull()
    })

    it("returns null when code is empty", () => {
        expect(parseVoidloginsSourceUrl("voidlogins://")).toBeNull()
    })

    it("decodes percent-encoded characters", () => {
        expect(parseVoidloginsSourceUrl("voidlogins://my%20code/my%40pass")).toEqual({
            code: "my code",
            password: "my@pass",
        })
    })

    it("treats trailing slash as empty password", () => {
        expect(parseVoidloginsSourceUrl("voidlogins://CODE/")).toEqual({ code: "CODE", password: "" })
    })
})

describe("buildVoidloginsSourceUrl", () => {
    it("builds URL with code only", () => {
        expect(buildVoidloginsSourceUrl("CODE123")).toBe("voidlogins://CODE123")
    })

    it("builds URL with code and password", () => {
        expect(buildVoidloginsSourceUrl("CODE", "PASS")).toBe("voidlogins://CODE/PASS")
    })

    it("omits password segment when password is empty string", () => {
        expect(buildVoidloginsSourceUrl("CODE", "")).toBe("voidlogins://CODE")
    })

    it("percent-encodes special characters", () => {
        expect(buildVoidloginsSourceUrl("my code", "my@pass")).toBe("voidlogins://my%20code/my%40pass")
    })

    it("round-trips with parseVoidloginsSourceUrl", () => {
        const url = buildVoidloginsSourceUrl("CODE", "PASS")
        expect(parseVoidloginsSourceUrl(url)).toEqual({ code: "CODE", password: "PASS" })
    })

    it("round-trips with special characters", () => {
        const url = buildVoidloginsSourceUrl("my code", "my@pass")
        expect(parseVoidloginsSourceUrl(url)).toEqual({ code: "my code", password: "my@pass" })
    })
})
