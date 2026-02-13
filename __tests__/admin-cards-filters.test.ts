import { describe, expect, it } from "@jest/globals"
import {
    DEFAULT_CARD_FILTERS,
    buildCardFiltersQuery,
    parseCardFilters,
} from "@/app/admin/(main)/cards/cards-filters"

describe("cards-filters", () => {
    it("should fall back to defaults for invalid numbers", () => {
        const result = parseCardFilters({
            page: "-1",
            pageSize: "0",
        })

        expect(result.page).toBe(DEFAULT_CARD_FILTERS.page)
        expect(result.pageSize).toBe(DEFAULT_CARD_FILTERS.pageSize)
    })

    it("should clamp pageSize to [1, 100]", () => {
        const small = parseCardFilters({ pageSize: "0" })
        const large = parseCardFilters({ pageSize: "999" })

        expect(small.pageSize).toBeGreaterThanOrEqual(1)
        expect(large.pageSize).toBeLessThanOrEqual(100)
    })

    it("should only accept known status values", () => {
        const all = parseCardFilters({ status: "UNKNOWN" })
        const unsold = parseCardFilters({ status: "UNSOLD" })

        expect(all.status).toBe("ALL")
        expect(unsold.status).toBe("UNSOLD")
    })

    it("should trim string filters", () => {
        const result = parseCardFilters({
            productKeyword: "  hello ",
            orderNo: "  ABC ",
            codeLike: "  1234 ",
        })

        expect(result.productKeyword).toBe("hello")
        expect(result.orderNo).toBe("ABC")
        expect(result.codeLike).toBe("1234")
    })

    it("should not emit default values in query string", () => {
        const query = buildCardFiltersQuery(DEFAULT_CARD_FILTERS)
        expect(query).toBe("")
    })

    it("should build query string for non-default filters", () => {
        const query = buildCardFiltersQuery({
            ...DEFAULT_CARD_FILTERS,
            page: 2,
            status: "UNSOLD",
            productKeyword: "abc",
            orderNo: "NO",
            codeLike: "1234",
        })

        expect(query).toContain("page=2")
        expect(query).toContain("status=UNSOLD")
        expect(query).toContain("productKeyword=abc")
        expect(query).toContain("orderNo=NO")
        expect(query).toContain("codeLike=1234")
    })
})

