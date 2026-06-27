import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { buildDistributorViewRows, type DistributorViewRow } from "./view-rows"
import type { TierSummaryItem } from "./types"

export type DistributorDetailBase = {
    row: DistributorViewRow
    tiers: TierSummaryItem[]
}

/**
 * Load a distributor's view-model row + commission tiers by id.
 *
 * Wrapped in React cache() so the page (auth guard + header) and any tab panel
 * that needs the overview aggregates share a single query per request — the
 * detail route also reuses it to stay DRY.
 *
 * Returns null when the id does not belong to a distributor; the caller maps
 * that to notFound(). buildDistributorViewRows does NOT validate the subject's
 * role, so the role guard must live here at the fetch boundary.
 */
export const getDistributorDetailBase = cache(
    async (id: string): Promise<DistributorDetailBase | null> => {
        const [user, tiersRaw] = await Promise.all([
            prisma.user.findUnique({
                where: { id, role: "DISTRIBUTOR" },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    name: true,
                    distributorCode: true,
                    discountCodeEnabled: true,
                    discountPercent: true,
                    disabledAt: true,
                    createdAt: true,
                    inviter: {
                        select: { id: true, name: true, distributorCode: true },
                    },
                },
            }),
            prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } }),
        ])

        if (!user) return null

        const rows = await buildDistributorViewRows([user])
        const tiers: TierSummaryItem[] = tiersRaw.map((t) => ({
            minAmount: Number(t.minAmount),
            maxAmount: Number(t.maxAmount),
            ratePercent: Number(t.ratePercent),
            sortOrder: t.sortOrder,
        }))

        return { row: rows[0], tiers }
    },
)

export type DistributorBasic = {
    id: string
    name: string
    email: string | null
    username: string | null
    distributorCode: string | null
    disabledAt: Date | null
}

/**
 * Lightweight distributor lookup for the page header + role guard, without the
 * heavy overview aggregates. Cached per request. Non-overview tabs use this so
 * switching tabs does not re-run buildDistributorViewRows' aggregate queries.
 */
export const getDistributorBasic = cache(
    async (id: string): Promise<DistributorBasic | null> => {
        return prisma.user.findUnique({
            where: { id, role: "DISTRIBUTOR" },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                distributorCode: true,
                disabledAt: true,
            },
        })
    },
)
