import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { PageHeader } from "@/app/admin/components"
import { WithdrawalDataTable } from "./withdrawal-data-table"
import { BackfillButton } from "./backfill-button"

type Props = { params: Promise<{ id: string }> }

const TYPE_LABELS: Record<string, string> = {
    alipay: "支付宝",
    wxpay: "微信支付",
    qqpay: "QQ支付",
}

export default async function PaymentChannelDetailPage({ params }: Props) {
    const session = await getAdminSession()
    if (!session) redirect("/admin/login")

    const { id } = await params

    const channel = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!channel) notFound()

    const year = new Date().getFullYear()
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year + 1, 0, 1)

    const [yearIncomeAgg, totalIncomeAgg, totalWithdrawnAgg, withdrawals, pendingBackfillCount] = await Promise.all([
        prisma.order.aggregate({
            where: {
                paymentChannelId: id,
                status: "COMPLETED",
                paidAt: { gte: yearStart, lt: yearEnd },
            },
            _sum: { amount: true },
        }),
        prisma.order.aggregate({
            where: { paymentChannelId: id, status: "COMPLETED" },
            _sum: { amount: true },
        }),
        prisma.channelWithdrawal.aggregate({
            where: { channelId: id },
            _sum: { amount: true },
        }),
        prisma.channelWithdrawal.findMany({
            where: { channelId: id },
            orderBy: { createdAt: "desc" },
        }),
        prisma.order.count({
            where: { paymentChannelId: null, paymentMethod: channel.type },
        }),
    ])

    const yearIncome = Number(yearIncomeAgg._sum.amount ?? 0)
    const totalIncome = Number(totalIncomeAgg._sum.amount ?? 0)
    const totalWithdrawn = Number(totalWithdrawnAgg._sum.amount ?? 0)
    const balance = totalIncome - totalWithdrawn
    const annualLimit = Number(channel.annualLimit)

    const withdrawalRows = withdrawals.map((w) => ({
        id: w.id,
        channelId: w.channelId,
        amount: Number(w.amount),
        note: w.note ?? "",
        createdAt: w.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/payment-channels">
                            <ArrowLeft className="size-4" />
                        </Link>
                    </Button>
                    <PageHeader title="渠道详情" description={channel.nickname} />
                </div>
                <BackfillButton
                    channelId={id}
                    channelNickname={channel.nickname}
                    pendingCount={pendingBackfillCount}
                    typeLabel={TYPE_LABELS[channel.type] ?? channel.type}
                />
            </div>

            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">渠道</p>
                            <p className="text-lg font-semibold">{channel.nickname}</p>
                            <p className="text-sm text-muted-foreground">{channel.pid}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">类型</p>
                            <Badge variant="outline" className="mt-1">
                                {TYPE_LABELS[channel.type] ?? channel.type}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">状态</p>
                            <Badge variant={channel.isActive ? "default" : "secondary"} className="mt-1">
                                {channel.isActive ? "启用" : "停用"}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">年度收入</p>
                            <p className="font-medium">
                                {formatCurrency(yearIncome)}{" "}
                                <span className="text-muted-foreground text-sm">/ {formatCurrency(annualLimit)}</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">当前余额</p>
                            <p className="font-medium">{formatCurrency(balance)}</p>
                            <p className="text-xs text-muted-foreground">
                                累计收入 {formatCurrency(totalIncome)} · 已提现 {formatCurrency(totalWithdrawn)}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <WithdrawalDataTable channelId={id} initialData={withdrawalRows} />
        </div>
    )
}
