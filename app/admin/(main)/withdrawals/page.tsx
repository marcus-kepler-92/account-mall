import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock, CheckCircle2, XCircle } from "lucide-react"
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
        }),
    ])

    const counts = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        PAID: statusCounts.find((c) => c.status === "PAID")?._count.id ?? 0,
        REJECTED: statusCounts.find((c) => c.status === "REJECTED")?._count.id ?? 0,
    }

    const statCards = [
        {
            key: "PENDING" as const,
            label: "待处理",
            value: counts.PENDING,
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
        },
        {
            key: "PAID" as const,
            label: "已打款",
            value: counts.PAID,
            icon: CheckCircle2,
            color: "text-success",
            borderColor: "border-l-success",
        },
        {
            key: "REJECTED" as const,
            label: "已拒绝",
            value: counts.REJECTED,
            icon: XCircle,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
        },
    ]

    const data: WithdrawalRow[] = withdrawals.map((w) => ({
        id: w.id,
        distributorId: w.distributorId,
        distributor: w.distributor,
        amount: Number(w.amount),
        status: w.status,
        receiptImageUrl: w.receiptImageUrl,
        note: w.note,
        processedAt: w.processedAt?.toISOString() ?? null,
        createdAt: w.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">提现管理</h2>
                <p className="text-muted-foreground">
                    处理分销员提现申请，线下打款后标记已打款或拒绝
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {statCards.map((stat) => (
                    <Link href={`/admin/withdrawals`} key={stat.key}>
                        <Card
                            className={`border-l-4 ${stat.borderColor} transition-colors hover:bg-accent/50 cursor-pointer`}
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
                    </Link>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>提现记录</CardTitle>
                    <CardDescription>
                        待处理：线下打款后点击「标记已打款」并填写备注；或「拒绝」并填写原因
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WithdrawalsDataTable data={data} />
                </CardContent>
            </Card>
        </div>
    )
}
