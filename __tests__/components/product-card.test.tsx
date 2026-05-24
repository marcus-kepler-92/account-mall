/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { ProductCard, type ProductCardData } from "@/app/components/product-card"

// next/image is heavy in jsdom; lightweight stub keeps the render synchronous.
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

// SoldOutOverlay pulls in Tailwind class wiring we don't care about here.
jest.mock("@/app/components/sold-out-overlay", () => ({
    __esModule: true,
    SoldOutOverlay: () => null,
}))

function baseProduct(overrides: Partial<ProductCardData> = {}): ProductCardData {
    return {
        id: "p1",
        name: "Test Product",
        slug: "test-product",
        description: null,
        summary: null,
        image: null,
        price: 0,
        stock: 1,
        tags: [],
        ...overrides,
    }
}

describe("ProductCard — MANUAL variant pricing", () => {
    it("renders single variant min price without 起 suffix when min === max", () => {
        render(
            <ProductCard
                product={baseProduct({
                    productType: "MANUAL",
                    price: 0,
                    priceMin: 29.9,
                    priceMax: 29.9,
                })}
            />,
        )
        // Single price label, no range suffix.
        expect(screen.getAllByText("¥29.90").length).toBeGreaterThan(0)
        expect(screen.queryByText(/起/)).toBeNull()
    })

    it("renders min price with 起 suffix when min < max", () => {
        render(
            <ProductCard
                product={baseProduct({
                    productType: "MANUAL",
                    price: 0,
                    priceMin: 29.9,
                    priceMax: 168,
                })}
            />,
        )
        expect(screen.getAllByText(/¥29\.90 起/).length).toBeGreaterThan(0)
        // Critical regression guard: must not fall through to ¥0.00.
        expect(screen.queryByText(/¥0\.00/)).toBeNull()
    })

    it("falls back to ¥0.00 when MANUAL has no active variants (degenerate)", () => {
        render(
            <ProductCard
                product={baseProduct({
                    productType: "MANUAL",
                    price: 0,
                    priceMin: null,
                    priceMax: null,
                })}
            />,
        )
        // Degenerate state — no variants to price against. The catalog hides
        // these via stock filtering, but the card itself stays defensive.
        expect(screen.getAllByText("¥0.00").length).toBeGreaterThan(0)
    })

    it("applies discount on top of MANUAL min price, preserving 起 suffix", () => {
        render(
            <ProductCard
                product={baseProduct({
                    productType: "MANUAL",
                    price: 0,
                    priceMin: 168,
                    priceMax: 200,
                })}
                discountPercent={10}
            />,
        )
        // Original price shown line-through with 起.
        expect(screen.getAllByText(/¥168\.00 起/).length).toBeGreaterThan(0)
        // 168 * 0.9 = 151.20 — must keep 起 because it's still a range.
        expect(screen.getAllByText(/¥151\.20 起/).length).toBeGreaterThan(0)
    })

    it("NORMAL product keeps using Product.price (no regression)", () => {
        render(
            <ProductCard
                product={baseProduct({
                    productType: "NORMAL",
                    price: 99,
                    priceMin: null,
                    priceMax: null,
                })}
            />,
        )
        expect(screen.getAllByText("¥99.00").length).toBeGreaterThan(0)
        expect(screen.queryByText(/起/)).toBeNull()
    })
})
