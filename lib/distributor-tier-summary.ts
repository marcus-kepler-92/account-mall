import { prisma } from "@/lib/prisma"

/** Natural week: Monday 00:00:00 UTC for the given date. */
function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getUTCDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setUTCDate(d.getUTCDate() + diff)
    d.setUTCHours(0, 0, 0, 0)
    return d
}

/** Adjust raw tier rate for upline deduction. If distributor has an inviter,
 *  the inviter takes level2Rate% of the commission, so the effective rate is
 *  rawRate × (1 - level2Rate/100). */
export function adjustRate(rawRate: number, level2Rate: number, hasInviter: boolean): number {
    return hasInviter ? Math.round(rawRate * (1 - level2Rate / 100) * 100) / 100 : rawRate
}

export type TierSummaryItem = {
    minAmount: number
    maxAmount: number
    ratePercent: number
    sortOrder: number
}

export type DistributorTierSummary = {
    weeklySalesTotal: number
    currentTier: TierSummaryItem | null
    tiersList: TierSummaryItem[]
    nextTier: TierSummaryItem | null
    encouragementMessage: string
    hasInviter: boolean
}

export async function getDistributorTierSummary(
    distributorId: string,
    level2Rate: number,
): Promise<DistributorTierSummary> {
    const now = new Date()
    const weekStart = getWeekStart(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

    const [weekOrders, tiers, selfUser] = await Promise.all([
        prisma.order.findMany({
            where: {
                distributorId,
                status: "COMPLETED",
                paidAt: { gte: weekStart, lt: weekEnd },
            },
            select: { amount: true },
        }),
        prisma.commissionTier.findMany({
            orderBy: { sortOrder: "asc" },
        }),
        prisma.user.findUnique({
            where: { id: distributorId },
            select: { inviterId: true },
        }),
    ])

    const hasInviter = !!selfUser?.inviterId
    const weeklySalesTotal = weekOrders.reduce((sum, o) => sum + Number(o.amount), 0)
    const tiersList: TierSummaryItem[] = tiers.map((t) => ({
        minAmount: Number(t.minAmount),
        maxAmount: Number(t.maxAmount),
        ratePercent: Number(t.ratePercent),
        sortOrder: t.sortOrder,
    }))

    let currentTier: TierSummaryItem | null = null
    for (const t of tiers) {
        const min = Number(t.minAmount)
        const max = Number(t.maxAmount)
        if (weeklySalesTotal >= min && weeklySalesTotal < max) {
            currentTier = {
                minAmount: min,
                maxAmount: max,
                ratePercent: Number(t.ratePercent),
                sortOrder: t.sortOrder,
            }
            break
        }
    }
    // Mirror the fallback in complete-pending-order.ts: when weekly sales don't
    // match any tier bracket, the effective rate is still tiers[0].
    if (currentTier === null && tiersList.length > 0) {
        currentTier = tiersList[0]
    }

    let nextTier: TierSummaryItem | null = null
    if (currentTier) {
        const next = tiers.find((t) => t.sortOrder > currentTier!.sortOrder)
        if (next) {
            nextTier = {
                minAmount: Number(next.minAmount),
                maxAmount: Number(next.maxAmount),
                ratePercent: Number(next.ratePercent),
                sortOrder: next.sortOrder,
            }
        }
    } else if (tiers.length > 0) {
        nextTier = {
            minAmount: Number(tiers[0].minAmount),
            maxAmount: Number(tiers[0].maxAmount),
            ratePercent: Number(tiers[0].ratePercent),
            sortOrder: tiers[0].sortOrder,
        }
    }

    let encouragementMessage: string
    if (currentTier) {
        if (nextTier) {
            const gap = nextTier.minAmount - weeklySalesTotal
            const displayRate = adjustRate(nextTier.ratePercent, level2Rate, hasInviter)
            encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可晋级下一档（奖金比例 ${displayRate}%）`
        } else {
            encouragementMessage = "您已处于最高档，继续保持！"
        }
    } else {
        if (nextTier) {
            const gap = nextTier.minAmount - weeklySalesTotal
            const displayRate = adjustRate(nextTier.ratePercent, level2Rate, hasInviter)
            encouragementMessage = `再完成 ¥${gap.toFixed(2)} 即可达到第一档（奖金比例 ${displayRate}%）`
        } else {
            encouragementMessage = "暂无阶梯档位，完成订单即可获得基础奖金。"
        }
    }

    return {
        weeklySalesTotal,
        currentTier,
        tiersList,
        nextTier,
        encouragementMessage,
        hasInviter,
    }
}
