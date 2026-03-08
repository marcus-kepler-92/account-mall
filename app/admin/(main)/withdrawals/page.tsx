import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WithdrawalsTable } from "./withdrawals-table"
import { Clock, CheckCircle2, XCircle } from "lucide-react"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{ status?: string }>

export default async function AdminWithdrawalsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const params = await searchParams
    const status = params.status as "PENDING" | "PAID" | "REJECTED" | null

    const where: { status?: "PENDING" | "PAID" | "REJECTED" } = {}
    if (status === "PENDING" || status === "PAID" || status === "REJECTED") {
        where.status = status
    }

    const [withdrawals, statusCounts] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
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
            value: String(counts.PENDING),
            icon: Clock,
            color: "text-warning",
            borderColor: "border-l-warning",
            active: status === "PENDING",
        },
        {
            key: "PAID" as const,
            label: "已打款",
            value: String(counts.PAID),
            icon: CheckCircle2,
            color: "text-success",
            borderColor: "border-l-success",
            active: status === "PAID",
        },
        {
            key: "REJECTED" as const,
            label: "已拒绝",
            value: String(counts.REJECTED),
            icon: XCircle,
            color: "text-muted-foreground",
            borderColor: "border-l-muted-foreground",
            active: status === "REJECTED",
        },
    ]

    const data = withdrawals.map((w) => ({
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
                {statCards.map((stat) => {
                    const cardEl = (
                        <Card
                            key={stat.key}
                            className={`border-l-4 ${stat.borderColor} transition-colors hover:bg-accent/50 cursor-pointer ${stat.active ? "ring-2 ring-primary/20 bg-accent/30" : ""}`}
                        >
                            <CardContent className="pt-4 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                                    </div>
                                    <stat.icon className={`size-8 ${stat.color} opacity-80`} />
                                </div>
                            </CardContent>
                        </Card>
                    )
                    const href = stat.active ? "/admin/withdrawals" : `/admin/withdrawals?status=${stat.key}`
                    return (
                        <Link href={href} key={stat.key}>
                            {cardEl}
                        </Link>
                    )
                })}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>提现记录</CardTitle>
                    <CardDescription>
                        待处理：线下打款后点击「标记已打款」并填写备注；或「拒绝」并填写原因
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <WithdrawalsTable data={data} currentStatus={status} />
                </CardContent>
            </Card>
        </div>
    )
}
