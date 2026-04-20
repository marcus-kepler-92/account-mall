import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
    parseDistributorFilters,
    type DistributorFiltersInput,
} from "./distributors-filters"
import { DistributorsDataTable } from "./distributors-data-table"
import type { DistributorRow } from "./distributors-columns"
import { PageHeader } from "@/app/admin/components"
import { parseServerSort } from "@/lib/table-sort"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    search?: string
    status?: string
    sort?: string
    sortDir?: string
}>

export default async function AdminDistributorsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const rawParams = await searchParams
    const filters = parseDistributorFilters(rawParams as DistributorFiltersInput)
    const { page, pageSize, search } = filters

    const rawSort = rawParams.sort ?? null
    const rawSortDir = rawParams.sortDir ?? null
    const isSalesSort = rawSort === "salesTotal"
    const sortDir: "asc" | "desc" = rawSortDir === "asc" ? "asc" : "desc"

    const { orderBy } = isSalesSort
        ? { orderBy: { createdAt: "desc" as const } }
        : parseServerSort(rawSort, rawSortDir, ["createdAt", "name"] as const, { sort: "createdAt", sortDir: "desc" })

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
            { username: { contains: term, mode: "insensitive" } },
            { distributorCode: { contains: term, mode: "insensitive" } },
        ]
    }

    const now = new Date()
    const dayOfWeek = now.getUTCDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setUTCDate(now.getUTCDate() + diff)
    weekStart.setUTCHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekStart.getUTCDate() + 7)

    const distributorSelect = {
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
    } as const

    type DistributorItem = Prisma.UserGetPayload<{ select: typeof distributorSelect }>

    let distributors: DistributorItem[] = []
    let total = 0
    let enabledCount = 0
    let disabledCount = 0
    let tiersRaw: Awaited<ReturnType<typeof prisma.commissionTier.findMany>> = []

    if (isSalesSort) {
        // Mirror the Prisma `where` as raw SQL for the view join query
        const rawWhere: Prisma.Sql[] = [Prisma.sql`u.role = 'DISTRIBUTOR'`]
        if (filters.statusList.length === 1) {
            if (filters.statusList[0] === "enabled") rawWhere.push(Prisma.sql`u."disabledAt" IS NULL`)
            else rawWhere.push(Prisma.sql`u."disabledAt" IS NOT NULL`)
        }
        if (search) {
            const term = `%${search.trim().toLowerCase()}%`
            rawWhere.push(Prisma.sql`(LOWER(u.name) LIKE ${term} OR LOWER(u.email) LIKE ${term} OR LOWER(u.username) LIKE ${term} OR LOWER(u."distributorCode") LIKE ${term})`)
        }
        const whereExpr = Prisma.join(rawWhere, " AND ")
        const dirSql = Prisma.raw(sortDir === "asc" ? "ASC" : "DESC")
        const offset = (page - 1) * pageSize

        const [rawRows, countRows, enabledC, disabledC, tiersR] = await Promise.all([
            prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
                SELECT u.id
                FROM "User" u
                LEFT JOIN "DistributorSalesView" dsv ON dsv."userId" = u.id
                WHERE ${whereExpr}
                ORDER BY COALESCE(dsv."salesTotal", 0) ${dirSql}
                LIMIT ${pageSize} OFFSET ${offset}
            `),
            prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
                SELECT COUNT(*)::bigint AS count FROM "User" u WHERE ${whereExpr}
            `),
            prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
            prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: { not: null } } }),
            prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } }),
        ])

        total = Number(countRows[0].count)
        enabledCount = enabledC
        disabledCount = disabledC
        tiersRaw = tiersR

        const orderedIds = rawRows.map(r => r.id)
        if (orderedIds.length > 0) {
            const unsorted = await prisma.user.findMany({
                where: { id: { in: orderedIds } },
                select: distributorSelect,
            })
            const indexMap = new Map(orderedIds.map((id, i) => [id, i]))
            distributors = [...unsorted].sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0))
        }
    } else {
        ;[distributors, total, enabledCount, disabledCount, tiersRaw] = await Promise.all([
            prisma.user.findMany({
                where,
                select: distributorSelect,
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.user.count({ where }),
            prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: null } }),
            prisma.user.count({ where: { role: "DISTRIBUTOR", disabledAt: { not: null } } }),
            prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } }),
        ])
    }

    const ids = distributors.map((d) => d.id)
    const [
        orderCounts,
        weeklyOrders,
        commissionAll,
        level1Settled,
        level2Settled,
        withdrawalPaid,
        withdrawalPending,
        inviteeCounts,
        inviteeList,
    ] =
        ids.length > 0
            ? await Promise.all([
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
                      where: { distributorId: { in: ids }, status: "SETTLED" },
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
              ])
            : [[], [], [], [], [], [], [], [], []]

    const orderCountMap = new Map(
        orderCounts.map((o) => [o.distributorId, o._count.id])
    )
    const salesTotalMap = new Map(
        orderCounts.map((o) => [o.distributorId, Number(o._sum.amount ?? 0)])
    )
    const weeklyTotalMap = new Map(
        weeklyOrders.map((o) => [o.distributorId, Number(o._sum.amount ?? 0)])
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
    const inviteeListMap = new Map<string, { id: string; name: string; distributorCode: string | null }[]>()
    for (const u of inviteeList) {
        if (!u.inviterId) continue
        const arr = inviteeListMap.get(u.inviterId) ?? []
        arr.push({ id: u.id, name: u.name, distributorCode: u.distributorCode })
        inviteeListMap.set(u.inviterId, arr)
    }

    // Split totalCommission into level1 + level2 for display
    const level1AllMap = new Map<string, number>()
    const level2AllMap = new Map<string, number>()
    if (ids.length > 0) {
        const [l1All, l2All] = await Promise.all([
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
            username: d.username,
            name: d.name,
            distributorCode: d.distributorCode,
            discountCodeEnabled: d.discountCodeEnabled,
            discountPercent: d.discountPercent != null ? Number(d.discountPercent) : null,
            disabledAt: d.disabledAt?.toISOString() ?? null,
            createdAt: d.createdAt.toISOString(),
            completedOrderCount: orderCountMap.get(d.id) ?? 0,
            salesTotal: salesTotalMap.get(d.id) ?? 0,
            weeklySalesTotal: weeklyTotalMap.get(d.id) ?? 0,
            totalCommission: commissionAllMap.get(d.id) ?? 0,
            level1CommissionTotal: level1AllMap.get(d.id) ?? 0,
            level2CommissionTotal: level2AllMap.get(d.id) ?? 0,
            level1Settled: l1Settled,
            level2Settled: l2Settled,
            paidTotal: paid,
            pendingTotal: pending,
            withdrawableBalance,
            inviteeCount: inviteeCountMap.get(d.id) ?? 0,
            invitees: inviteeListMap.get(d.id) ?? [],
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
    const tiers = tiersRaw.map((t) => ({
        minAmount: Number(t.minAmount),
        maxAmount: Number(t.maxAmount),
        ratePercent: Number(t.ratePercent),
        sortOrder: t.sortOrder,
    }))

    return (
        <div className="space-y-6">
            <PageHeader title="分销员管理" description="查看分销员列表、启用/停用、订单与佣金汇总" />
            <DistributorsDataTable data={data} total={total} statusCounts={statusCounts} tiers={tiers} />
        </div>
    )
}
