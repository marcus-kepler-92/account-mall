import { describe, expect, it } from "@jest/globals"
import {
    parseDetailPaging,
    getCurrentTier,
    sumOrderCommission,
    mapTeamRows,
} from "@/app/admin/(main)/distributors/[id]/data"

describe("parseDetailPaging", () => {
    it("defaults to page 1, pageSize 20", () => {
        expect(parseDetailPaging({})).toEqual({ page: 1, pageSize: 20 })
    })

    it("clamps invalid/negative page to 1", () => {
        expect(parseDetailPaging({ page: "-3" }).page).toBe(1)
        expect(parseDetailPaging({ page: "abc" }).page).toBe(1)
    })

    it("clamps pageSize to [1, 100]", () => {
        expect(parseDetailPaging({ pageSize: "0" }).pageSize).toBe(20) // 0 → default
        expect(parseDetailPaging({ pageSize: "500" }).pageSize).toBe(100)
        expect(parseDetailPaging({ pageSize: "50" }).pageSize).toBe(50)
    })
})

const tiers = [
    { minAmount: 0, maxAmount: 100, ratePercent: 5, sortOrder: 0 },
    { minAmount: 100, maxAmount: 500, ratePercent: 10, sortOrder: 1 },
    { minAmount: 500, maxAmount: Number.POSITIVE_INFINITY, ratePercent: 15, sortOrder: 2 },
]

describe("getCurrentTier", () => {
    it("locates the bracket containing weekly sales", () => {
        expect(getCurrentTier(250, tiers)?.index).toBe(1)
        expect(getCurrentTier(0, tiers)?.index).toBe(0)
        expect(getCurrentTier(9999, tiers)?.index).toBe(2)
    })

    it("returns null for empty tiers", () => {
        expect(getCurrentTier(100, [])).toBeNull()
    })

    it("falls back to the first tier when outside every range", () => {
        expect(getCurrentTier(-5, tiers)?.index).toBe(0)
    })
})

describe("sumOrderCommission", () => {
    it("sums non-cancelled commissions without float drift", () => {
        expect(
            sumOrderCommission([
                { amount: 1.5, status: "SETTLED" },
                { amount: 2.3, status: "PENDING" },
            ]),
        ).toBe(3.8)
    })

    it("excludes CANCELLED records", () => {
        expect(
            sumOrderCommission([
                { amount: 1.5, status: "SETTLED" },
                { amount: 9.9, status: "CANCELLED" },
            ]),
        ).toBe(1.5)
    })

    it("returns 0 for an empty list", () => {
        expect(sumOrderCommission([])).toBe(0)
    })
})

describe("mapTeamRows", () => {
    it("assembles rows with tier label and aggregate maps", () => {
        const rows = mapTeamRows(
            [
                {
                    id: "u1",
                    name: "Alice",
                    email: "a@x.com",
                    username: null,
                    distributorCode: "D1",
                    disabledAt: null,
                    createdAt: new Date("2025-01-01T00:00:00Z"),
                },
            ],
            {
                weekly: new Map([["u1", 250]]),
                sales: new Map([["u1", 1000]]),
                orderCount: new Map([["u1", 7]]),
                level2: new Map([["u1", 12.5]]),
                tiers: [
                    { minAmount: 0, maxAmount: 100, ratePercent: 5 },
                    { minAmount: 100, maxAmount: 500, ratePercent: 10 },
                ],
            },
        )

        expect(rows[0]).toMatchObject({
            id: "u1",
            name: "Alice",
            disabled: false,
            weeklySalesTotal: 250,
            salesTotal: 1000,
            completedOrderCount: 7,
            level2CommissionTotal: 12.5,
            createdAt: "2025-01-01T00:00:00.000Z",
        })
        expect(rows[0].tierLabel).toContain("10%") // 250 ∈ [100,500) → 第2档
    })

    it("marks disabled and defaults missing aggregates to 0", () => {
        const rows = mapTeamRows(
            [
                {
                    id: "u2",
                    name: null,
                    email: null,
                    username: "bob",
                    distributorCode: null,
                    disabledAt: new Date("2025-02-01T00:00:00Z"),
                    createdAt: "2025-02-01T00:00:00.000Z",
                },
            ],
            {
                weekly: new Map(),
                sales: new Map(),
                orderCount: new Map(),
                level2: new Map(),
                tiers: [],
            },
        )

        expect(rows[0]).toMatchObject({
            disabled: true,
            weeklySalesTotal: 0,
            salesTotal: 0,
            completedOrderCount: 0,
            level2CommissionTotal: 0,
            tierLabel: null,
        })
    })
})
