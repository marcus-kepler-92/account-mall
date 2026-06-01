import type { CommissionMode } from "@prisma/client"
import { adjustRate } from "@/lib/domains/distributors"
import type { DistributorTierSummary } from "@/lib/domains/distributors"

// Product fields needed to disclose how a distributor's commission is computed.
// Mirrors the settlement logic in createOrderCommissions (service.ts) so the
// disclosure shows the same numbers the distributor will actually be paid.
export type ProductForDisclosure = {
    price: number
    commissionMode: CommissionMode
    commissionValue: number | null
}

// A disclosure row following the industry-standard "rate% + estimated ¥" form
// (Taobao/JD/Douyin affiliate). All figures are take-home: the rate is already
// net of the level-2 split (via adjustRate), so rate × price reproduces the
// shown earnings — no "advertised rate ≠ paid rate" gap. Every earning is a
// PER-UNIT estimate (computed from one unit's price), so the page labels all
// of them "/件" uniformly.
export type ProductCommissionEstimate = {
    // false → shown in the "not participating" section (NONE / free lead-gen).
    participating: boolean
    // Short label for the settlement rule.
    modeLabel: string
    modeTone: "earning" | "free" | "excluded"
    // Take-home commission rate %. null for FIXED_AMOUNT (no percentage) and
    // non-participating rows.
    ratePercent: number | null
    // Annotation next to the rate, e.g. "你当前档" for GLOBAL. null otherwise.
    rateNote: string | null
    // Net per-unit amount earned at the distributor's current state. null = cannot quote.
    currentEarn: number | null
    // GLOBAL only: take-home rate at the top tier, shown when there's headroom.
    topRatePercent: number | null
    // GLOBAL only: net per-unit amount at the top tier, paired with topRatePercent.
    maxEarn: number | null
    // Explanation shown in the "not participating" section.
    note: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function estimateProductCommission(
    product: ProductForDisclosure,
    tier: DistributorTierSummary,
    level2Rate: number,
): ProductCommissionEstimate {
    const hasInviter = tier.hasInviter

    // Free products (price 0) never produce commission regardless of mode — even
    // GLOBAL/PERCENT yield price × rate = 0. Surfacing this as a distinct state
    // kills the "shown as participating but always ¥0" grey zone.
    if (product.price <= 0) {
        return {
            participating: false,
            modeLabel: "免费引流款",
            modeTone: "free",
            ratePercent: null,
            rateNote: null,
            currentEarn: null,
            topRatePercent: null,
            maxEarn: null,
            note: "免费引流款，不计佣金",
        }
    }

    switch (product.commissionMode) {
        case "NONE":
            return {
                participating: false,
                modeLabel: "不参与分销",
                modeTone: "excluded",
                ratePercent: null,
                rateNote: null,
                currentEarn: null,
                topRatePercent: null,
                maxEarn: null,
                note: "暂不参与分销",
            }

        case "FIXED_AMOUNT": {
            // Per-unit flat amount has no percentage. Level-2 split still applies
            // to the total commission, so the per-unit take-home is value × (1-L2).
            const value = product.commissionValue ?? 0
            const perUnitEarn = hasInviter ? round2(value * (1 - level2Rate / 100)) : round2(value)
            return {
                participating: true,
                modeLabel: "固定金额",
                modeTone: "earning",
                ratePercent: null,
                rateNote: null,
                currentEarn: perUnitEarn,
                topRatePercent: null,
                maxEarn: null,
                note: null,
            }
        }

        case "FIXED_PERCENT": {
            const pct = product.commissionValue ?? 0
            // Take-home rate = configured rate net of level-2 split.
            const rate = adjustRate(pct, level2Rate, hasInviter)
            return {
                participating: true,
                modeLabel: "售价百分比",
                modeTone: "earning",
                ratePercent: rate,
                rateNote: null,
                currentEarn: round2(product.price * (rate / 100)),
                topRatePercent: null,
                maxEarn: null,
                note: null,
            }
        }

        case "GLOBAL":
        default: {
            const current = tier.currentTier
            // No tiers configured at all → participates but cannot quote a rate.
            if (!current) {
                return {
                    participating: true,
                    modeLabel: "全局阶梯分成",
                    modeTone: "earning",
                    ratePercent: null,
                    rateNote: null,
                    currentEarn: null,
                    topRatePercent: null,
                    maxEarn: null,
                    note: null,
                }
            }
            const currentRate = adjustRate(current.ratePercent, level2Rate, hasInviter)
            // Top tier = highest raw rate in the ladder (tiersList is ascending).
            const topTier = tier.tiersList.length > 0 ? tier.tiersList[tier.tiersList.length - 1] : current
            const hasHeadroom = topTier.ratePercent > current.ratePercent
            const topRate = hasHeadroom ? adjustRate(topTier.ratePercent, level2Rate, hasInviter) : null
            return {
                participating: true,
                modeLabel: "全局阶梯分成",
                modeTone: "earning",
                ratePercent: currentRate,
                rateNote: "你当前档",
                currentEarn: round2(product.price * (currentRate / 100)),
                topRatePercent: topRate,
                maxEarn: topRate != null ? round2(product.price * (topRate / 100)) : null,
                note: null,
            }
        }
    }
}
