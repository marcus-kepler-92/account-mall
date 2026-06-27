import type { TierSummaryItem } from "@/lib/domains/distributors"
import { computeInviteeTierInfo } from "@/app/distributor/(main)/invitees/invitees-utils"

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

/**
 * Parse the shared `page`/`pageSize` URL params used by every detail tab.
 * Tabs are mutually exclusive (lazy-loaded), so a single shared key is safe.
 */
export function parseDetailPaging(params: {
    page?: string | null
    pageSize?: string | null
}): { page: number; pageSize: number } {
    const page = Math.max(1, parseInt(params.page ?? "", 10) || 1)
    const rawPageSize = parseInt(params.pageSize ?? "", 10) || PAGE_SIZE_DEFAULT
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, rawPageSize))
    return { page, pageSize }
}

/**
 * Locate the distributor's current weekly tier. Mirrors the pure logic from
 * distributor-detail-sheet so the overview tab renders the same bracket.
 * Falls back to the first tier when sales fall outside every range.
 */
export function getCurrentTier(
    weeklySalesTotal: number,
    tiers: TierSummaryItem[],
): { tier: TierSummaryItem; index: number } | null {
    for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i]
        if (weeklySalesTotal >= t.minAmount && weeklySalesTotal < t.maxAmount) {
            return { tier: t, index: i }
        }
    }
    return tiers.length > 0 ? { tier: tiers[0], index: 0 } : null
}

const toCents = (v: number) => Math.round(v * 100)

/**
 * Sum the commission earned on a single order, excluding CANCELLED records.
 * Integer-cents accumulation avoids float drift across multiple commissions.
 */
export function sumOrderCommission(
    commissions: { amount: number; status: string }[],
): number {
    const cents = commissions
        .filter((c) => c.status !== "CANCELLED")
        .reduce((sum, c) => sum + toCents(c.amount), 0)
    return cents / 100
}

export type TeamMemberRow = {
    id: string
    name: string | null
    email: string | null
    username: string | null
    distributorCode: string | null
    disabled: boolean
    weeklySalesTotal: number
    salesTotal: number
    completedOrderCount: number
    level2CommissionTotal: number
    tierLabel: string | null
    createdAt: string
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v)

/**
 * Assemble downline rows from the invitee list and the per-downline aggregate
 * maps (weekly sales, total sales, order count, level-2 commission contributed
 * to the parent). Pure — the prisma groupBy work happens in the team tab.
 */
export function mapTeamRows(
    invitees: {
        id: string
        name: string | null
        email: string | null
        username: string | null
        distributorCode: string | null
        disabledAt: Date | string | null
        createdAt: Date | string
    }[],
    maps: {
        weekly: Map<string, number>
        sales: Map<string, number>
        orderCount: Map<string, number>
        level2: Map<string, number>
        tiers: { minAmount: number; maxAmount: number; ratePercent: number }[]
    },
): TeamMemberRow[] {
    return invitees.map((u) => {
        const weeklySalesTotal = maps.weekly.get(u.id) ?? 0
        const { tierLabel } = computeInviteeTierInfo(weeklySalesTotal, maps.tiers)
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            username: u.username,
            distributorCode: u.distributorCode,
            disabled: !!u.disabledAt,
            weeklySalesTotal,
            salesTotal: maps.sales.get(u.id) ?? 0,
            completedOrderCount: maps.orderCount.get(u.id) ?? 0,
            level2CommissionTotal: maps.level2.get(u.id) ?? 0,
            tierLabel,
            createdAt: toIso(u.createdAt),
        }
    })
}
