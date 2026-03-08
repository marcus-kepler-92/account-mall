import { redirect } from "next/navigation"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import Link from "next/link"
import { ApplyWithdrawalForm } from "./apply-withdrawal-form"
import { DistributorCommissionsPagination } from "./commissions-pagination"
import { EmptyState } from "@/app/components/empty-state"
import { Button } from "@/components/ui/button"
import { Coins } from "lucide-react"

export const dynamic = "force-dynamic"

const statusConfig: Record<string, { label: string; variant: "warning" | "success" | "secondary" }> = {
    PENDING: { label: "待结算", variant: "warning" },
    SETTLED: { label: "已结算", variant: "success" },
    WITHDRAWN: { label: "已提现", variant: "secondary" },
}

export default async function DistributorCommissionsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const page = Math.max(1, parseInt(params.page ?? "1", 10))
    const pageSize = 20

    const [commissions, total, settledSum, paidSum, pendingSum, tierSummary] = await Promise.all([
        prisma.commission.findMany({
            where: { distributorId: user.id },
            include: { order: { select: { orderNo: true, amount: true, paidAt: true } } },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.commission.count({ where: { distributorId: user.id } }),
        prisma.commission.aggregate({
            where: { distributorId: user.id, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: user.id, status: "PAID" },
            _sum: { amount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { distributorId: user.id, status: "PENDING" },
            _sum: { amount: true },
        }),
        getDistributorTierSummary(user.id),
    ])

    const settledTotal = Number(settledSum._sum.amount ?? 0)
    const paidTotal = Number(paidSum._sum.amount ?? 0)
    const pendingWithdrawalTotal = Number(pendingSum._sum.amount ?? 0)
    const withdrawableBalance = settledTotal - paidTotal - pendingWithdrawalTotal
    const totalPages = Math.ceil(total / pageSize) || 1

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">我的佣金</h1>
                <p className="text-muted-foreground">佣金明细与可提现余额</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>当周业绩与阶梯</CardTitle>
                    <CardDescription>
                        当周累计销售额 ¥{tierSummary.weeklySalesTotal.toFixed(2)}
                        {tierSummary.currentTier
                            ? ` · 当前第 ${tierSummary.currentTier.sortOrder + 1} 档，佣金比例 ${tierSummary.currentTier.ratePercent}%`
                            : " · 暂无档位"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">{tierSummary.encouragementMessage}</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
                    <div>
                        <CardTitle>可提现余额</CardTitle>
                        <CardDescription>
                            已结算 − 已打款 − 提现中 = 可提现余额；申请提现后由管理员线下打款
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/distributor/withdrawals">查看提现记录</Link>
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-3xl font-bold">¥{withdrawableBalance.toFixed(2)}</p>
                    {pendingWithdrawalTotal > 0 && (
                        <p className="text-sm text-muted-foreground">
                            提现中：¥{pendingWithdrawalTotal.toFixed(2)}（处理中，到账后余额将更新）
                        </p>
                    )}
                    <ApplyWithdrawalForm
                        withdrawableBalance={withdrawableBalance}
                        pendingWithdrawalTotal={pendingWithdrawalTotal}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>佣金明细</CardTitle>
                    <CardDescription>共 {total} 笔</CardDescription>
                </CardHeader>
                <CardContent>
                    {commissions.length === 0 ? (
                        <EmptyState
                            icon={<Coins className="size-8 text-muted-foreground" />}
                            title="暂无佣金记录"
                            description="订单完成后将在此展示。"
                        />
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>订单号</TableHead>
                                        <TableHead className="text-right">佣金金额</TableHead>
                                        <TableHead>状态</TableHead>
                                        <TableHead>时间</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {commissions.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-mono text-xs">
                                                {c.order.orderNo}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                ¥{Number(c.amount).toFixed(2)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={statusConfig[c.status]?.variant ?? "outline"}>
                                                    {statusConfig[c.status]?.label ?? c.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(c.createdAt).toLocaleString("zh-CN")}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {totalPages > 1 && (
                                <DistributorCommissionsPagination
                                    page={page}
                                    totalPages={totalPages}
                                    total={total}
                                />
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
