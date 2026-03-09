import { buildProductDetailRedirectPath } from "@/lib/product-canonical-url"

describe("buildProductDetailRedirectPath", () => {
    it("returns path with promoCode in query when promoCode is provided", () => {
        expect(
            buildProductDetailRedirectPath("prod_1", "canonical-slug", "ABC")
        ).toBe("/products/prod_1-canonical-slug?promoCode=ABC")
    })

    it("returns path without query when promoCode is missing", () => {
        expect(buildProductDetailRedirectPath("prod_1", "canonical-slug")).toBe(
            "/products/prod_1-canonical-slug"
        )
    })

    it("returns path without query when promoCode is empty string", () => {
        expect(
            buildProductDetailRedirectPath("prod_1", "canonical-slug", "")
        ).toBe("/products/prod_1-canonical-slug")
    })

    it("returns path without query when promoCode is only whitespace", () => {
        expect(
            buildProductDetailRedirectPath("prod_1", "canonical-slug", "  ")
        ).toBe("/products/prod_1-canonical-slug")
    })

    it("trims promoCode when building query", () => {
        expect(
            buildProductDetailRedirectPath("prod_1", "canonical-slug", "  XYZ  ")
        ).toBe("/products/prod_1-canonical-slug?promoCode=XYZ")
    })
})
