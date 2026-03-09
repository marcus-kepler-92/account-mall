import { redirect } from "next/navigation"
import Link from "next/link"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import {
    parseDistributorWithdrawalFilters,
    type DistributorWithdrawalFiltersInput,
} from "./withdrawals-filters"
import { DistributorWithdrawalsDataTable } from "./withdrawals-data-table"
import type { DistributorWithdrawalRow } from "./withdrawals-columns"

export const dynamic = "force-dynamic"

export default async function DistributorWithdrawalsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; pageSize?: string; status?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const filters = parseDistributorWithdrawalFilters(params as DistributorWithdrawalFiltersInput)

    const where: { distributorId: string; status?: { in: ("PENDING" | "PAID" | "REJECTED")[] } } = {
        distributorId: user.id,
    }
    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
    }

    const [withdrawals, total, statusCounts] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.groupBy({
            by: ["status"],
            where: { distributorId: user.id },
            _count: { id: true },
        }),
    ])

    const withdrawalStats = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        PAID: statusCounts.find((c) => c.status === "PAID")?._count.id ?? 0,
        REJECTED: statusCounts.find((c) => c.status === "REJECTED")?._count.id ?? 0,
    }

    const rows: DistributorWithdrawalRow[] = withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        status: w.status,
        createdAt: w.createdAt.toISOString(),
        processedAt: w.processedAt?.toISOString() ?? null,
        note: w.note,
    }))

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">提现记录</h2>
                    <p className="text-muted-foreground">申请提现与处理状态</p>
                </div>
                <Button asChild className="min-h-11 touch-manipulation">
                    <Link href="/distributor/commissions">申请提现</Link>
                </Button>
            </div>

            <div>
                <h3 className="text-lg font-semibold">提现记录</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    共 {total} 条，打款由管理员线下处理
                </p>
                <DistributorWithdrawalsDataTable
                    data={rows}
                    total={total}
                    statusCounts={withdrawalStats}
                />
            </div>
        </div>
    )
}
