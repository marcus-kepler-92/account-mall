import { prisma } from "@/lib/prisma"
import { formatCurrency, getHKTYearBounds } from "@/lib/utils"
import { Wallet, TrendingUp, LayoutGrid } from "lucide-react"
import { PaymentChannelsDataTable } from "./payment-channels-data-table"
import type { ChannelRow } from "./payment-channels-columns"
import { PageHeader, StatCard } from "@/app/admin/components"

export const dynamic = "force-dynamic"

export default async function AdminPaymentChannelsPage() {
    const channels = await prisma.paymentChannel.findMany({
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    })

    const channelIds = channels.map((c) => c.id)
    const { start, end } = getHKTYearBounds()

    const [yearIncomeRows, totalIncomeRows, withdrawalRows] =
        channelIds.length > 0
            ? await Promise.all([
                  prisma.order.groupBy({
                      by: ["paymentChannelId"],
                      where: { paymentChannelId: { in: channelIds }, status: "COMPLETED", paidAt: { gte: start, lt: end } },
                      _sum: { amount: true },
                  }),
                  prisma.order.groupBy({
                      by: ["paymentChannelId"],
                      where: { paymentChannelId: { in: channelIds }, status: "COMPLETED" },
                      _sum: { amount: true },
                  }),
                  prisma.channelWithdrawal.groupBy({
                      by: ["channelId"],
                      where: { channelId: { in: channelIds } },
                      _sum: { amount: true },
                  }),
              ])
            : [[], [], []]

    const yearMap = new Map(yearIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const totalMap = new Map(totalIncomeRows.map((r) => [r.paymentChannelId, Number(r._sum.amount ?? 0)]))
    const withdrawnMap = new Map(withdrawalRows.map((r) => [r.channelId, Number(r._sum.amount ?? 0)]))

    const data: ChannelRow[] = channels.map((c) => {
        const yearIncome = yearMap.get(c.id) ?? 0
        const totalIncome = totalMap.get(c.id) ?? 0
        const totalWithdrawn = withdrawnMap.get(c.id) ?? 0
        return {
            id: c.id,
            nickname: c.nickname,
            pid: c.pid,
            key: c.key,
            submitUrl: c.submitUrl,
            siteName: c.siteName,
            type: c.type,
            annualLimit: Number(c.annualLimit),
            sortOrder: c.sortOrder,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            yearIncome,
            totalIncome,
            totalWithdrawn,
            balance: totalIncome - totalWithdrawn,
        }
    })

    const totalYearIncome = data.reduce((s, c) => s + c.yearIncome, 0)
    const totalBalance = data.reduce((s, c) => s + c.balance, 0)

    return (
        <div className="space-y-6">
            <PageHeader
                title="收款渠道"
                description="管理易支付收款渠道，记录提现，追踪年度进度与余额"
            />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <StatCard label="总渠道数" value={String(channels.length)} icon={LayoutGrid} borderColor="border-l-primary" iconColor="text-primary" />
                <StatCard label="年度总收入" value={formatCurrency(totalYearIncome)} icon={TrendingUp} borderColor="border-l-muted-foreground" iconColor="text-muted-foreground" />
                <StatCard label="总余额" value={formatCurrency(totalBalance)} icon={Wallet} borderColor="border-l-success" iconColor="text-success" />
            </div>

            <PaymentChannelsDataTable data={data} />
        </div>
    )
}
