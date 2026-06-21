import { describe, expect, it } from "@jest/globals"
import {
    DEFAULT_DISTRIBUTOR_ORDER_FILTERS,
    parseDistributorOrderFilters,
} from "@/app/distributor/(main)/orders/orders-filters"

describe("parseDistributorOrderFilters", () => {
    it("falls back to defaults for invalid numbers", () => {
        const result = parseDistributorOrderFilters({ page: "-1", pageSize: "0" })

        expect(result.page).toBe(DEFAULT_DISTRIBUTOR_ORDER_FILTERS.page)
        expect(result.pageSize).toBe(DEFAULT_DISTRIBUTOR_ORDER_FILTERS.pageSize)
    })

    it("clamps pageSize to [1, 100]", () => {
        expect(parseDistributorOrderFilters({ pageSize: "0" }).pageSize).toBeGreaterThanOrEqual(1)
        expect(parseDistributorOrderFilters({ pageSize: "999" }).pageSize).toBeLessThanOrEqual(100)
    })

    it("accepts REFUNDED as a valid status filter", () => {
        const result = parseDistributorOrderFilters({ status: "REFUNDED" })

        expect(result.statusList).toEqual(["REFUNDED"])
    })

    it("accepts the full distributor-facing status set", () => {
        const result = parseDistributorOrderFilters({
            status: "PENDING,COMPLETED,CLOSED,REFUNDED",
        })

        expect(result.statusList).toEqual(["PENDING", "COMPLETED", "CLOSED", "REFUNDED"])
    })

    it("drops unknown status values and keeps valid ones", () => {
        const result = parseDistributorOrderFilters({ status: "REFUNDED,PROCESSING,FOO" })

        expect(result.statusList).toEqual(["REFUNDED"])
    })

    it("returns an empty status list when no status is provided", () => {
        expect(parseDistributorOrderFilters({}).statusList).toEqual([])
    })

    it("trims the search filter", () => {
        expect(parseDistributorOrderFilters({ search: "  ABC123 " }).search).toBe("ABC123")
    })
})
