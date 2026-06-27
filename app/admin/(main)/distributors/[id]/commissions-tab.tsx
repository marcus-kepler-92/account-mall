import { notFound } from "next/navigation"
import { Wallet, Coins, TrendingUp, Send } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { StatCard } from "@/app/admin/components"
import { getDistributorDetailBase } from "@/lib/domains/distributors"
import { parseDetailQuery } from "./query"
import { DetailSortableDataTable } from "./detail-sortable-data-table"
import {
    distributorCommissionsColumns,
    commissionStatusOptions,
    type DistributorCommissionRow,
} from "./commissions-columns"

const COMMISSION_STATUSES = ["PENDING", "SETTLED", "WITHDRAWN", "CANCELLED"]

export async function CommissionsTab({
    distributorId,
    searchParams,
}: {
    distributorId: string
    searchParams: Record<string, string | undefined>
}) {
    const base = await getDistributorDetailBase(distributorId)
    if (!base) notFound()
    const { row } = base

    const { page, pageSize, orderBy, statusList, search } = parseDetailQuery(
        searchParams,
        COMMISSION_STATUSES,
    )

    // Default view hides CANCELLED records (matches the distributor-facing page).
    const where: Record<string, unknown> = {
        distributorId,
        status: statusList.length > 0 ? { in: statusList } : { not: "CANCELLED" },
    }
    if (search) where.order = { orderNo: { contains: search } }

    const [commissions, total] = await Promise.all([
        prisma.commission.findMany({
            where,
            include: { order: { select: { orderNo: true } } },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.commission.count({ where }),
    ])

    // Resolve the downline names behind level-2 commissions in one batch query.
    const sourceIds = [
        ...new Set(
            commissions
                .map((c) => c.sourceDistributorId)
                .filter((v): v is string => !!v),
        ),
    ]
    const sources =
        sourceIds.length > 0
            ? await prisma.user.findMany({
                  where: { id: { in: sourceIds } },
                  select: { id: true, name: true },
              })
            : []
    const sourceMap = new Map(sources.map((s) => [s.id, s.name]))

    const data: DistributorCommissionRow[] = commissions.map((c) => ({
        id: c.id,
        orderId: c.orderId,
        orderNo: c.order.orderNo,
        amount: Number(c.amount),
        status: c.status,
        level: c.level,
        sourceName: c.sourceDistributorId
            ? (sourceMap.get(c.sourceDistributorId) ?? null)
            : null,
        createdAt: c.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="可提现余额"
                    value={formatCurrency(row.withdrawableBalance)}
                    icon={Wallet}
                    borderColor="border-l-success"
                    iconColor="text-success"
                />
                <StatCard
                    label="一级已结算"
                    value={formatCurrency(row.level1Settled)}
                    icon={Coins}
                    borderColor="border-l-primary"
                    iconColor="text-primary"
                />
                <StatCard
                    label="二级已结算"
                    value={formatCurrency(row.level2Settled)}
                    icon={TrendingUp}
                    borderColor="border-l-warning"
                    iconColor="text-warning"
                />
                <StatCard
                    label="已打款"
                    value={formatCurrency(row.paidTotal)}
                    icon={Send}
                    borderColor="border-l-muted-foreground"
                    iconColor="text-muted-foreground"
                />
            </div>
            <DetailSortableDataTable
                data={data}
                total={total}
                columns={distributorCommissionsColumns}
                statusOptions={commissionStatusOptions}
                searchPlaceholder="搜索订单号..."
                emptyMessage="暂无佣金记录"
            />
        </div>
    )
}
