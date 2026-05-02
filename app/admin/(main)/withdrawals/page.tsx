import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Clock, CheckCircle2, XCircle, Wallet, DollarSign } from "lucide-react"
import { WithdrawalsDataTable } from "./withdrawals-data-table"
import type { WithdrawalRow } from "./withdrawals-columns"
import {
    DEFAULT_WITHDRAWAL_FILTERS,
    parseWithdrawalFilters,
    type WithdrawalFiltersInput,
} from "./withdrawals-filters"
import { PageHeader, StatCard } from "@/app/admin/components"
import { parseServerSort } from "@/lib/table-sort"

export const dynamic = "force-dynamic"

type SearchParams = Promise<WithdrawalFiltersInput & { sort?: string; sortDir?: string }>

export default async function AdminWithdrawalsPage({ searchParams }: { searchParams: SearchParams }) {
    const raw = await searchParams
    const filters = parseWithdrawalFilters(raw)
    const { page, pageSize, statusList, search } = filters
    const { orderBy } = parseServerSort(
        raw.sort ?? null,
        raw.sortDir ?? null,
        ["createdAt", "amount"] as const,
        { sort: "createdAt", sortDir: "desc" }
    )

    // Build where clause for main query
    const where = {
        ...(statusList.length > 0 ? { status: { in: statusList } } : {}),
        ...(search
            ? {
                  distributor: {
                      OR: [
                          { name: { contains: search, mode: "insensitive" as const } },
                          { email: { contains: search, mode: "insensitive" as const } },
                      ],
                  },
              }
            : {}),
    }

    const [withdrawals, total, statusCounts] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
            include: {
                distributor: {
                    select: { id: true, email: true, username: true, name: true },
                },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.groupBy({
            by: ["status"],
            _count: { id: true },
            _sum: { amount: true },
        }),
    ])

    const counts = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        PAID: statusCounts.find((c) => c.status === "PAID")?._count.id ?? 0,
        REJECTED: statusCounts.find((c) => c.status === "REJECTED")?._count.id ?? 0,
    }
    const amounts = {
        PENDING: Number(statusCounts.find((c) => c.status === "PENDING")?._sum.amount ?? 0),
        PAID: Number(statusCounts.find((c) => c.status === "PAID")?._sum.amount ?? 0),
    }

    // Calculate platform total withdrawable balance
    const allDistributorIds = await prisma.user
        .findMany({ where: { role: "DISTRIBUTOR" }, select: { id: true } })
        .then((users) => users.map((u) => u.id))

    const [allLevel1, allLevel2, allPaid, allPending] = await Promise.all([
        prisma.commission.aggregate({
            where: { distributorId: { in: allDistributorIds }, level: 1, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.commission.aggregate({
            where: { distributorId: { in: allDistributorIds }, level: 2, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: { in: allDistributorIds }, status: "PAID" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: { in: allDistributorIds }, status: "PENDING" },
            _sum: { amount: true },
        }),
    ])
    const platformTotalWithdrawable =
        Number(allLevel1._sum.amount ?? 0) +
        Number(allLevel2._sum.amount ?? 0) -
        Number(allPaid._sum.amount ?? 0) -
        Number(allPending._sum.amount ?? 0)

    // Per-distributor balance for current page
    const withdrawalDistIds = [...new Set(withdrawals.map((w) => w.distributorId))]
    const [distL1, distL2, distPaid, distPending] =
        withdrawalDistIds.length > 0
            ? await Promise.all([
                  prisma.commission.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: withdrawalDistIds }, level: 1, status: "SETTLED" },
                      _sum: { amount: true },
                  }),
                  prisma.commission.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: withdrawalDistIds }, level: 2, status: "SETTLED" },
                      _sum: { amount: true },
                  }),
                  prisma.withdrawal.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: withdrawalDistIds }, status: "PAID" },
                      _sum: { amount: true },
                  }),
                  prisma.withdrawal.groupBy({
                      by: ["distributorId"],
                      where: { distributorId: { in: withdrawalDistIds }, status: "PENDING" },
                      _sum: { amount: true },
                  }),
              ])
            : [[], [], [], []]

    const l1Map = new Map(distL1.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))
    const l2Map = new Map(distL2.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))
    const paidMap = new Map(distPaid.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))
    const pendingMap = new Map(distPending.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))

    const data: WithdrawalRow[] = withdrawals.map((w) => {
        const l1 = l1Map.get(w.distributorId) ?? 0
        const l2 = l2Map.get(w.distributorId) ?? 0
        const paid = paidMap.get(w.distributorId) ?? 0
        const pending = pendingMap.get(w.distributorId) ?? 0
        const currentBalance = l1 + l2 - paid - pending
        const feeAmount = Number(w.feeAmount ?? 0)
        return {
            id: w.id,
            distributorId: w.distributorId,
            distributor: w.distributor,
            amount: Number(w.amount),
            feePercent: Number(w.feePercent ?? 0),
            feeAmount,
            actualAmount: Math.round((Number(w.amount) - feeAmount) * 100) / 100,
            status: w.status,
            receiptImageUrl: w.receiptImageUrl,
            note: w.note,
            processedAt: w.processedAt?.toISOString() ?? null,
            createdAt: w.createdAt.toISOString(),
            level1Settled: l1,
            level2Settled: l2,
            paidTotal: paid,
            pendingTotal: pending,
            currentBalance,
        }
    })

    const buildStatusLink = (statusKey: "PENDING" | "REJECTED") => {
        const params = new URLSearchParams()
        const nextList = filters.statusList.includes(statusKey)
            ? filters.statusList.filter((s) => s !== statusKey)
            : [...filters.statusList, statusKey]
        if (nextList.length > 0) {
            params.set("status", nextList.join(","))
        }
        const query = params.toString()
        return `/admin/withdrawals${query ? `?${query}` : ""}`
    }

    return (
        <div className="space-y-6">
            <PageHeader title="提现管理" description="处理分销员提现申请，线下打款后标记已打款或拒绝" />

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
                <StatCard label="待处理" value={counts.PENDING} icon={Clock} borderColor="border-l-warning" iconColor="text-warning" active={filters.statusList.includes("PENDING")} href={buildStatusLink("PENDING")} />
                <StatCard label="待处理金额" value={formatCurrency(amounts.PENDING)} icon={DollarSign} borderColor="border-l-warning" iconColor="text-warning" />
                <StatCard label="已打款金额" value={formatCurrency(amounts.PAID)} icon={CheckCircle2} borderColor="border-l-success" iconColor="text-success" />
                <StatCard label="已拒绝" value={counts.REJECTED} icon={XCircle} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" active={filters.statusList.includes("REJECTED")} href={buildStatusLink("REJECTED")} />
                <StatCard label="平台待提现总额" value={formatCurrency(platformTotalWithdrawable)} icon={Wallet} borderColor="border-l-primary" iconColor="text-primary" />
            </div>

            <WithdrawalsDataTable
                data={data}
                total={total}
                defaultFilters={DEFAULT_WITHDRAWAL_FILTERS}
            />
        </div>
    )
}
