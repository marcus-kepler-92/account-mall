import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import { Wallet, TrendingUp, ArrowDownCircle } from "lucide-react"
import { PageHeader, StatCard } from "@/app/admin/components"
import { getFinanceSummary } from "@/lib/domains/finance"
import { PayoutDataTable } from "./payout-data-table"
import type { PayoutRow } from "./payout-columns"

export const dynamic = "force-dynamic"

export default async function AdminFinancePage() {
    const [summary, payouts] = await Promise.all([
        getFinanceSummary(),
        prisma.payout.findMany({ orderBy: { createdAt: "desc" } }),
    ])

    const rows: PayoutRow[] = payouts.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        note: p.note ?? "",
        createdAt: p.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader title="资金管理" description="收款账户的累计收入、提现与余额" />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <StatCard label="累计收入" value={formatCurrency(summary.totalIncomeCents / 100)} icon={TrendingUp} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
                <StatCard label="已提现" value={formatCurrency(summary.totalWithdrawnCents / 100)} icon={ArrowDownCircle} borderColor="border-l-primary" iconColor="text-primary" />
                <StatCard label="当前余额" value={formatCurrency(summary.balanceCents / 100)} icon={Wallet} borderColor="border-l-success" iconColor="text-success" />
            </div>

            <PayoutDataTable initialData={rows} />
        </div>
    )
}
