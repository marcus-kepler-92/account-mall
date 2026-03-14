import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { Clock, CheckCircle2, XCircle, Wallet, DollarSign } from "lucide-react"
import { WithdrawalsDataTable } from "./withdrawals-data-table"
import type { WithdrawalRow } from "./withdrawals-columns"

export const dynamic = "force-dynamic"

export default async function AdminWithdrawalsPage() {
    const [withdrawals, statusCounts] = await Promise.all([
        prisma.withdrawal.findMany({
            include: {
                distributor: {
                    select: { id: true, email: true, name: true },
                },
            },
            orderBy: { createdAt: "desc" },
        }),
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

    // Per-distributor balance for withdrawal rows
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

    const statCards = [
        {
            label: "待处理",
            value: counts.PENDING,
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
        },
        {
            label: "待处理金额",
            value: `¥${amounts.PENDING.toFixed(2)}`,
            icon: DollarSign,
            color: "text-warning",
            borderColor: "border-l-warning",
        },
        {
            label: "已打款金额",
            value: `¥${amounts.PAID.toFixed(2)}`,
            icon: CheckCircle2,
            color: "text-success",
            borderColor: "border-l-success",
        },
        {
            label: "已拒绝",
            value: counts.REJECTED,
            icon: XCircle,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
        },
        {
            label: "平台待提现总额",
            value: `¥${platformTotalWithdrawable.toFixed(2)}`,
            icon: Wallet,
            color: "text-primary",
            borderColor: "border-l-primary",
        },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">提现管理</h2>
                <p className="text-muted-foreground">
                    处理分销员提现申请，线下打款后标记已打款或拒绝
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {statCards.map((stat) => (
                    <Card
                        key={stat.label}
                        className={`border-l-4 ${stat.borderColor}`}
                    >
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {stat.label}
                                    </p>
                                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                </div>
                                <stat.icon className={`size-8 ${stat.color} opacity-80`} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <WithdrawalsDataTable data={data} />
        </div>
    )
}

