import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
    parseDistributorFilters,
    type DistributorFiltersInput,
} from "./distributors-filters"
import { DistributorsDataTable } from "./distributors-data-table"
import { PageHeader } from "@/app/admin/components"
import { parseServerSort } from "@/lib/table-sort"
import { buildDistributorViewRows } from "@/lib/domains/distributors"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{
    page?: string
    pageSize?: string
    search?: string
    status?: string
    sort?: string
    sortDir?: string
    inviterId?: string
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
    if (filters.inviterId) {
        where.inviterId = filters.inviterId
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

    let inviter: { id: string; name: string; distributorCode: string | null } | null = null
    if (filters.inviterId) {
        inviter = await prisma.user.findUnique({
            where: { id: filters.inviterId },
            select: { id: true, name: true, distributorCode: true },
        })
    }

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
        if (filters.inviterId) {
            rawWhere.push(Prisma.sql`u."inviterId" = ${filters.inviterId}`)
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

    const data = await buildDistributorViewRows(distributors)

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
            <DistributorsDataTable
                data={data}
                total={total}
                statusCounts={statusCounts}
                tiers={tiers}
                inviterFilter={inviter}
            />
        </div>
    )
}
