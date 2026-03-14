import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
    parseDistributorFilters,
    type DistributorFiltersInput,
} from "./distributors-filters"
import { DistributorsDataTable } from "./distributors-data-table"
import type { DistributorRow } from "./distributors-columns"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    search?: string
    status?: string
}>

export default async function AdminDistributorsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const rawParams = await searchParams
    const filters = parseDistributorFilters(rawParams as DistributorFiltersInput)
    const { page, pageSize, search } = filters

    const where: Prisma.UserWhereInput = {
        role: "DISTRIBUTOR",
    }
    if (filters.statusList.length === 1) {
        if (filters.statusList[0] === "enabled") where.disabledAt = null
        if (filters.statusList[0] === "disabled") where.disabledAt = { not: null }
    }
    if (search) {
        const term = search.trim().toLowerCase()
        where.OR = [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { distributorCode: { contains: term, mode: "insensitive" } },
        ]
    }

    const [distributors, total, enabledCount, disabledCount] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                email: true,
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
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.user.count({ where }),
        prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
        prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: { not: null } } }),
    ])

    const ids = distributors.map((d) => d.id)
    const [
        orderCounts,
        commissionAll,
        level1Settled,
        level2Settled,
        withdrawalPaid,
        withdrawalPending,
        inviteeCounts,
    ] =
        ids.length > 0
            ? await Promise.all([
                  prisma.order.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: ids }, status: "COMPLETED" },
                      _count: { id: true },
                  }),
                  prisma.commission.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: ids } },
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
              ])
            : [[], [], [], [], [], [], []]

    const orderCountMap = new Map(
        orderCounts.map((o) => [o.distributorId, o._count.id])
    )
    const commissionAllMap = new Map(
        commissionAll.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)])
    )
    const level1SettledMap = new Map(
        level1Settled.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)])
    )
    const level2SettledMap = new Map(
        level2Settled.map((c) => [c.distributorId, Number(c._sum.amount ?? 0)])
    )
    const paidMap = new Map(
        withdrawalPaid.map((w) => [w.distributorId, Number(w._sum.amount ?? 0)])
    )
    const pendingMap = new Map(
        withdrawalPending.map((w) => [w.distributorId, Number(w._sum.amount ?? 0)])
    )
    const inviteeCountMap = new Map(
        inviteeCounts.map((u) => [u.inviterId as string, u._count.id])
    )

    // Split totalCommission into level1 + level2 for display
    const level1AllMap = new Map<string, number>()
    const level2AllMap = new Map<string, number>()
    if (ids.length > 0) {
        const [l1All, l2All] = await Promise.all([
            prisma.commission.groupBy({
                by: ["distributorId"],
                where: { distributorId: { in: ids }, level: 1 },
                _sum: { amount: true },
            }),
            prisma.commission.groupBy({
                by: ["distributorId"],
                where: { distributorId: { in: ids }, level: 2 },
                _sum: { amount: true },
            }),
        ])
        l1All.forEach((c) => level1AllMap.set(c.distributorId, Number(c._sum.amount ?? 0)))
        l2All.forEach((c) => level2AllMap.set(c.distributorId, Number(c._sum.amount ?? 0)))
    }

    const data: DistributorRow[] = distributors.map((d) => {
        const l1Settled = level1SettledMap.get(d.id) ?? 0
        const l2Settled = level2SettledMap.get(d.id) ?? 0
        const paid = paidMap.get(d.id) ?? 0
        const pending = pendingMap.get(d.id) ?? 0
        const withdrawableBalance = l1Settled + l2Settled - paid - pending
        return {
            id: d.id,
            email: d.email,
            name: d.name,
            distributorCode: d.distributorCode,
            discountCodeEnabled: d.discountCodeEnabled,
            discountPercent: d.discountPercent != null ? Number(d.discountPercent) : null,
            disabledAt: d.disabledAt?.toISOString() ?? null,
            createdAt: d.createdAt.toISOString(),
            completedOrderCount: orderCountMap.get(d.id) ?? 0,
            totalCommission: commissionAllMap.get(d.id) ?? 0,
            level1CommissionTotal: level1AllMap.get(d.id) ?? 0,
            level2CommissionTotal: level2AllMap.get(d.id) ?? 0,
            level1Settled: l1Settled,
            level2Settled: l2Settled,
            paidTotal: paid,
            pendingTotal: pending,
            withdrawableBalance,
            inviteeCount: inviteeCountMap.get(d.id) ?? 0,
            inviter: d.inviter
                ? {
                      id: d.inviter.id,
                      name: d.inviter.name,
                      distributorCode: d.inviter.distributorCode,
                  }
                : null,
        }
    })

    const statusCounts = { enabled: enabledCount, disabled: disabledCount }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">分销员管理</h2>
                <p className="text-muted-foreground">
                    查看分销员列表、启用/停用、订单与佣金汇总
                </p>
            </div>
            <DistributorsDataTable data={data} total={total} statusCounts={statusCounts} />
        </div>
    )
}
