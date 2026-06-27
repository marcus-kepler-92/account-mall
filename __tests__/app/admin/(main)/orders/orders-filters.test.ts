import { describe, expect, it } from "@jest/globals"
import {
    DEFAULT_ORDER_FILTERS,
    parseOrderFilters,
    buildOrderFiltersQuery,
} from "@/app/admin/(main)/orders/orders-filters"

describe("parseOrderFilters — distributor filter", () => {
    it("returns an empty distributorIds list when none is provided", () => {
        expect(parseOrderFilters({}).distributorIds).toEqual([])
    })

    it("parses a single distributorId", () => {
        expect(parseOrderFilters({ distributorId: "dist_1" }).distributorIds).toEqual([
            "dist_1",
        ])
    })

    it("parses a comma-separated list of distributorIds", () => {
        expect(
            parseOrderFilters({ distributorId: "dist_1,dist_2,dist_3" }).distributorIds
        ).toEqual(["dist_1", "dist_2", "dist_3"])
    })

    it("trims whitespace and drops empty segments", () => {
        expect(
            parseOrderFilters({ distributorId: " dist_1 , , dist_2 ," }).distributorIds
        ).toEqual(["dist_1", "dist_2"])
    })
})

describe("buildOrderFiltersQuery — distributor filter", () => {
    it("omits the distributorId param when the list is empty", () => {
        const query = buildOrderFiltersQuery({ ...DEFAULT_ORDER_FILTERS })

        expect(query).not.toContain("distributorId")
    })

    it("serializes distributorIds as a comma-separated param", () => {
        const query = buildOrderFiltersQuery({
            ...DEFAULT_ORDER_FILTERS,
            distributorIds: ["dist_1", "dist_2"],
        })

        // URLSearchParams encodes the comma as %2C
        expect(query).toContain("distributorId=dist_1%2Cdist_2")
    })

    it("round-trips distributorIds through build and parse", () => {
        const query = buildOrderFiltersQuery({
            ...DEFAULT_ORDER_FILTERS,
            distributorIds: ["dist_1", "dist_2"],
        })
        const params = Object.fromEntries(new URLSearchParams(query.replace(/^\?/, "")))

        expect(parseOrderFilters(params).distributorIds).toEqual(["dist_1", "dist_2"])
    })
})
