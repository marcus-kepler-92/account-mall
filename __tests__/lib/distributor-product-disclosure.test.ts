import { estimateProductCommission } from "@/lib/distributor-product-disclosure"
import type { DistributorTierSummary, TierSummaryItem } from "@/lib/domains/distributors"

const LEVEL2 = 20

// Seeded ladder: 52 / 63 / 74 / 84 / 89 %.
const TIERS: TierSummaryItem[] = [
    { minAmount: 0, maxAmount: 400, ratePercent: 52, sortOrder: 0 },
    { minAmount: 400, maxAmount: 1200, ratePercent: 63, sortOrder: 1 },
    { minAmount: 1200, maxAmount: 3000, ratePercent: 74, sortOrder: 2 },
    { minAmount: 3000, maxAmount: 7600, ratePercent: 84, sortOrder: 3 },
    { minAmount: 7600, maxAmount: 99999999, ratePercent: 89, sortOrder: 4 },
]

// Distributor sitting in L2 (63%), next is L3.
function tierSummary(overrides: Partial<DistributorTierSummary> = {}): DistributorTierSummary {
    return {
        weeklySalesTotal: 480,
        currentTier: TIERS[1],
        nextTier: TIERS[2],
        tiersList: TIERS,
        encouragementMessage: "",
        hasInviter: false,
        ...overrides,
    }
}

describe("estimateProductCommission", () => {
    describe("免费引流款 (price 0)", () => {
        it("any mode with price 0 is non-participating, no commission", () => {
            for (const mode of ["GLOBAL", "FIXED_PERCENT", "FIXED_AMOUNT", "NONE"] as const) {
                const r = estimateProductCommission(
                    { price: 0, commissionMode: mode, commissionValue: 50 },
                    tierSummary(),
                    LEVEL2,
                )
                expect(r.participating).toBe(false)
                expect(r.modeTone).toBe("free")
                expect(r.currentEarn).toBeNull()
                expect(r.note).toBe("免费引流款，不计佣金")
            }
        })
    })

    describe("NONE", () => {
        it("excluded from distribution", () => {
            const r = estimateProductCommission(
                { price: 62, commissionMode: "NONE", commissionValue: null },
                tierSummary(),
                LEVEL2,
            )
            expect(r.participating).toBe(false)
            expect(r.modeTone).toBe("excluded")
            expect(r.currentEarn).toBeNull()
            expect(r.note).toBe("暂不参与分销")
        })
    })

    describe("FIXED_AMOUNT (per unit, no percentage)", () => {
        it("no upline → full per-unit value, no rate %", () => {
            const r = estimateProductCommission(
                { price: 50, commissionMode: "FIXED_AMOUNT", commissionValue: 8 },
                tierSummary({ hasInviter: false }),
                LEVEL2,
            )
            expect(r.participating).toBe(true)
            expect(r.ratePercent).toBeNull()
            expect(r.currentEarn).toBe(8)
            expect(r.maxEarn).toBeNull()
            expect(r.modeLabel).toBe("固定金额")
        })

        it("with upline → 20% carved out of per-unit value", () => {
            const r = estimateProductCommission(
                { price: 50, commissionMode: "FIXED_AMOUNT", commissionValue: 8 },
                tierSummary({ hasInviter: true }),
                LEVEL2,
            )
            expect(r.currentEarn).toBe(6.4) // 8 × 0.8
            expect(r.ratePercent).toBeNull()
        })
    })

    describe("FIXED_PERCENT (rate % is take-home)", () => {
        it("no upline → rate = configured percent, earn = price × rate", () => {
            const r = estimateProductCommission(
                { price: 80, commissionMode: "FIXED_PERCENT", commissionValue: 10 },
                tierSummary({ hasInviter: false }),
                LEVEL2,
            )
            expect(r.ratePercent).toBe(10)
            expect(r.currentEarn).toBe(8) // 80 × 10%
            expect(r.maxEarn).toBeNull()
            expect(r.modeLabel).toBe("售价百分比")
        })

        it("with upline → rate already net of split, earn reproduces from rate", () => {
            const r = estimateProductCommission(
                { price: 80, commissionMode: "FIXED_PERCENT", commissionValue: 10 },
                tierSummary({ hasInviter: true }),
                LEVEL2,
            )
            expect(r.ratePercent).toBe(8) // 10 × 0.8 (take-home)
            expect(r.currentEarn).toBe(6.4) // 80 × 8% — self-consistent with the shown rate
        })
    })

    describe("GLOBAL (tiered)", () => {
        it("current tier rate + take-home, surfaces top-tier headroom, no upline", () => {
            const r = estimateProductCommission(
                { price: 42, commissionMode: "GLOBAL", commissionValue: null },
                tierSummary({ hasInviter: false }),
                LEVEL2,
            )
            expect(r.modeLabel).toBe("全局阶梯分成")
            expect(r.ratePercent).toBe(63)
            expect(r.rateNote).toBe("你当前档")
            expect(r.currentEarn).toBe(26.46) // 42 × 63%
            expect(r.topRatePercent).toBe(89)
            expect(r.maxEarn).toBe(37.38) // 42 × 89%
        })

        it("with upline → rate and earnings both net of split, self-consistent", () => {
            const r = estimateProductCommission(
                { price: 42, commissionMode: "GLOBAL", commissionValue: null },
                tierSummary({ hasInviter: true }),
                LEVEL2,
            )
            expect(r.ratePercent).toBe(50.4) // 63 × 0.8
            expect(r.currentEarn).toBe(21.17) // 42 × 50.4% = 21.168 → 21.17
            expect(r.topRatePercent).toBe(71.2) // 89 × 0.8
            expect(r.maxEarn).toBe(29.9) // 42 × 71.2% = 29.904 → 29.9
        })

        it("zero weekly sales → uses lowest tier (L1), still shows top headroom", () => {
            const r = estimateProductCommission(
                { price: 42, commissionMode: "GLOBAL", commissionValue: null },
                tierSummary({ weeklySalesTotal: 0, currentTier: TIERS[0], nextTier: TIERS[1], hasInviter: false }),
                LEVEL2,
            )
            expect(r.ratePercent).toBe(52)
            expect(r.currentEarn).toBe(21.84) // 42 × 52%
            expect(r.topRatePercent).toBe(89)
            expect(r.maxEarn).toBe(37.38)
        })

        it("top tier (current === top) → no headroom shown", () => {
            const r = estimateProductCommission(
                { price: 42, commissionMode: "GLOBAL", commissionValue: null },
                tierSummary({ currentTier: TIERS[4], nextTier: null, hasInviter: false }),
                LEVEL2,
            )
            expect(r.ratePercent).toBe(89)
            expect(r.currentEarn).toBe(37.38) // 42 × 89%
            expect(r.topRatePercent).toBeNull()
            expect(r.maxEarn).toBeNull()
        })

        it("no tiers configured → participates but cannot quote", () => {
            const r = estimateProductCommission(
                { price: 42, commissionMode: "GLOBAL", commissionValue: null },
                tierSummary({ currentTier: null, nextTier: null, tiersList: [] }),
                LEVEL2,
            )
            expect(r.participating).toBe(true)
            expect(r.ratePercent).toBeNull()
            expect(r.currentEarn).toBeNull()
            expect(r.maxEarn).toBeNull()
        })
    })
})
