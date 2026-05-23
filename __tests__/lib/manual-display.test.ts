import { computeManualDisplay } from "@/lib/manual-display"

describe("computeManualDisplay", () => {
    describe("non-MANUAL products", () => {
        it("returns isManual=false and null fields for NORMAL", () => {
            const result = computeManualDisplay({ productType: "NORMAL" }, [])
            expect(result).toEqual({
                isManual: false,
                isUnavailable: false,
                priceMin: null,
                priceMax: null,
                priceLabel: null,
            })
        })

        it("returns isManual=false for AUTO_FETCH regardless of variants", () => {
            const result = computeManualDisplay(
                { productType: "AUTO_FETCH" },
                [{ price: "9.90", isActive: true }],
            )
            expect(result.isManual).toBe(false)
            expect(result.priceLabel).toBeNull()
        })
    })

    describe("MANUAL with empty variants", () => {
        it("marks the product as unavailable", () => {
            const result = computeManualDisplay({ productType: "MANUAL" }, [])
            expect(result.isManual).toBe(true)
            expect(result.isUnavailable).toBe(true)
            expect(result.priceMin).toBeNull()
            expect(result.priceMax).toBeNull()
            expect(result.priceLabel).toBeNull()
        })
    })

    describe("MANUAL with a single active variant", () => {
        it("renders a single price (no 起 suffix)", () => {
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [{ price: "9.90", isActive: true }],
            )
            expect(result.isUnavailable).toBe(false)
            expect(result.priceMin).toBe(9.9)
            expect(result.priceMax).toBe(9.9)
            expect(result.priceLabel).toBe("¥9.90")
        })
    })

    describe("MANUAL with multiple variants at the same price", () => {
        it("renders a single price label without 起", () => {
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [
                    { price: "9.90", isActive: true },
                    { price: "9.90", isActive: true },
                    { price: "9.90", isActive: true },
                ],
            )
            expect(result.priceMin).toBe(9.9)
            expect(result.priceMax).toBe(9.9)
            expect(result.priceLabel).toBe("¥9.90")
        })
    })

    describe("MANUAL with variants at different prices", () => {
        it("renders the min price with 起 suffix", () => {
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [
                    { price: "24.90", isActive: true },
                    { price: "9.90", isActive: true },
                    { price: "49.00", isActive: true },
                ],
            )
            expect(result.priceMin).toBe(9.9)
            expect(result.priceMax).toBe(49)
            expect(result.priceLabel).toBe("¥9.90 起")
        })
    })

    describe("MANUAL with all inactive variants", () => {
        it("treats the product as unavailable (same as empty)", () => {
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [
                    { price: "9.90", isActive: false },
                    { price: "24.90", isActive: false },
                ],
            )
            expect(result.isUnavailable).toBe(true)
            expect(result.priceMin).toBeNull()
            expect(result.priceMax).toBeNull()
            expect(result.priceLabel).toBeNull()
        })
    })

    describe("MANUAL filters inactive when computing the range", () => {
        it("ignores inactive variants in min/max calculation", () => {
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [
                    { price: "100.00", isActive: false }, // ignored
                    { price: "9.90", isActive: true },
                    { price: "24.90", isActive: true },
                    { price: "0.01", isActive: false }, // ignored — would be min if counted
                ],
            )
            expect(result.priceMin).toBe(9.9)
            expect(result.priceMax).toBe(24.9)
            expect(result.priceLabel).toBe("¥9.90 起")
        })
    })

    describe("MANUAL accepts Prisma Decimal-like price values", () => {
        it("calls toString on Decimal-like objects", () => {
            // Mimic a Prisma.Decimal — only requires a `toString` method.
            const decimal = { toString: () => "12.34" }
            const result = computeManualDisplay(
                { productType: "MANUAL" },
                [{ price: decimal, isActive: true }],
            )
            expect(result.priceMin).toBe(12.34)
            expect(result.priceLabel).toBe("¥12.34")
        })
    })
})
