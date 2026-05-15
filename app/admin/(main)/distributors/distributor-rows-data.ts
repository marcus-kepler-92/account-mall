import { prisma } from "@/lib/prisma"
import type { DistributorRow } from "./distributors-row-types"

const weekBounds = () => {
    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() + diff)
    weekStart.setUTCHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)
    return { weekStart, weekEnd }
}

type RawDistributorInput = {
    id: string
    email: string | null
    username: string | null
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: { toNumber(): number } | number | null
    disabledAt: Date | string | null
    createdAt: Date | string
    inviter: { id: string; name: string; distributorCode: string | null } | null
}

/**
 * Build DistributorRow view-model records for a given set of distributor users.
 * Accepts raw Prisma-shaped records (Decimal / Date fields) and returns
 * fully serialized DistributorRow values safe for JSON transport.
 */
export async function buildDistributorViewRows(
    distributors: RawDistributorInput[],
): Promise<DistributorRow[]> {
    if (distributors.length === 0) return []

    const ids = distributors.map((d) => d.id)
    const { weekStart, weekEnd } = weekBounds()

    const [
        milestones,
        triggeredBonuses,
        orderCounts,
        weeklyOrders,
        level1Settled,
        level2Settled,
        withdrawalPaid,
        withdrawalPending,
        inviteeCounts,
        inviteeList,
        level1All,
        level2All,
    ] = await Promise.all([
        prisma.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
        prisma.invitationMilestoneBonus.findMany({
            where: { inviterId: { in: ids } },
            select: { inviterId: true, milestoneId: true },
        }),
        prisma.order.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, status: "COMPLETED" },
            _count: { id: true },
            _sum: { amount: true },
        }),
        prisma.order.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, status: "COMPLETED", paidAt: { gte: weekStart, lt: weekEnd } },
            _sum: { amount: true },
        }),
        prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, level: 1, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, level: 2, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, status: "PAID" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, status: "PENDING" },
            _sum: { amount: true },
        }),
        prisma.user.groupBy({
            by: ["inviterId"],
            where: { inviterId: { in: ids } },
            _count: { id: true },
        }),
        prisma.user.findMany({
            where: { inviterId: { in: ids }, role: "DISTRIBUTOR" },
            select: { id: true, name: true, distributorCode: true, inviterId: true },
            orderBy: { name: "asc" },
        }),
        prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, level: 1, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.commission.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: ids }, level: 2, status: "SETTLED" },
            _sum: { amount: true },
        }),
    ])

    const triggeredByDistributor = new Map<string, Set<string>>()
    for (const b of triggeredBonuses) {
        const set = triggeredByDistributor.get(b.inviterId) ?? new Set<string>()
        set.add(b.milestoneId)
        triggeredByDistributor.set(b.inviterId, set)
    }

    const orderCountMap = new Map(orderCounts.map((o) => [o.distributorId, o._count.id]))
    const salesTotalMap = new Map(orderCounts.map((o) => [o.distributorId, Number(o._sum.amount ?? 0)]))
    const weeklyTotalMap = new Map(weeklyOrders.map((o) => [o.distributorId, Number(o._sum.amount ?? 0)]))
    const level1SettledMap = new Map(level1Settled.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)]))
    const level2SettledMap = new Map(level2Settled.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)]))
    const paidMap = new Map(withdrawalPaid.map((w) => [w.distributorId, Number(w._sum.amount ?? 0)]))
    const pendingMap = new Map(withdrawalPending.map((w) => [w.distributorId, Number(w._sum.amount ?? 0)]))
    const inviteeCountMap = new Map(inviteeCounts.map((u) => [u.inviterId as string, u._count.id]))
    const level1AllMap = new Map(level1All.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)]))
    const level2AllMap = new Map(level2All.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)]))

    const inviteeListMap = new Map<string, { id: string; name: string; distributorCode: string | null }[]>()
    for (const u of inviteeList) {
        if (!u.inviterId) continue
        const arr = inviteeListMap.get(u.inviterId) ?? []
        arr.push({ id: u.id, name: u.name, distributorCode: u.distributorCode })
        inviteeListMap.set(u.inviterId, arr)
    }

    const toStr = (v: Date | string) => (v instanceof Date ? v.toISOString() : v)

    return distributors.map((d) => {
        const l1Settled = level1SettledMap.get(d.id) ?? 0
        const l2Settled = level2SettledMap.get(d.id) ?? 0
        const paid = paidMap.get(d.id) ?? 0
        const pending = pendingMap.get(d.id) ?? 0
        const withdrawableBalance = l1Settled + l2Settled - paid - pending

        const discountPercent =
            d.discountPercent == null
                ? null
                : typeof d.discountPercent === "number"
                  ? d.discountPercent
                  : d.discountPercent.toNumber()

        return {
            id: d.id,
            email: d.email,
            username: d.username,
            name: d.name,
            distributorCode: d.distributorCode,
            discountCodeEnabled: d.discountCodeEnabled,
            discountPercent,
            disabledAt: d.disabledAt ? toStr(d.disabledAt) : null,
            createdAt: toStr(d.createdAt),
            completedOrderCount: orderCountMap.get(d.id) ?? 0,
            salesTotal: salesTotalMap.get(d.id) ?? 0,
            weeklySalesTotal: weeklyTotalMap.get(d.id) ?? 0,
            totalCommission: (level1AllMap.get(d.id) ?? 0) + (level2AllMap.get(d.id) ?? 0),
            level1CommissionTotal: level1AllMap.get(d.id) ?? 0,
            level2CommissionTotal: level2AllMap.get(d.id) ?? 0,
            level1Settled: l1Settled,
            level2Settled: l2Settled,
            paidTotal: paid,
            pendingTotal: pending,
            withdrawableBalance,
            inviteeCount: inviteeCountMap.get(d.id) ?? 0,
            invitees: inviteeListMap.get(d.id) ?? [],
            inviter: d.inviter,
            milestoneSummary: milestones.length > 0
                ? (() => {
                      const triggered = triggeredByDistributor.get(d.id) ?? new Set<string>()
                      const next = milestones.find((m) => !triggered.has(m.id)) ?? null
                      return {
                          triggeredCount: triggered.size,
                          nextMilestone: next
                              ? {
                                    thresholdAmount: Number(next.thresholdAmount),
                                    thresholdCount: next.thresholdCount,
                                    bonusAmount: Number(next.bonusAmount),
                                }
                              : null,
                      }
                  })()
                : null,
        }
    })
}
