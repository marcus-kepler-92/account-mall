import { redirect } from "next/navigation"
import Link from "next/link"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary"
import { Button } from "@/components/ui/button"
import {
    parseDistributorCommissionFilters,
    type DistributorCommissionFiltersInput,
} from "./commissions-filters"
import { DistributorCommissionsDataTable } from "./commissions-data-table"
import type { DistributorCommissionRow } from "./commissions-columns"
import { ApplyWithdrawalForm } from "./apply-withdrawal-form"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

export default async function DistributorCommissionsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; pageSize?: string; status?: string; search?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const filters = parseDistributorCommissionFilters(params as DistributorCommissionFiltersInput)

    const where: {
        distributorId: string
        status?: { in: ("PENDING" | "SETTLED" | "WITHDRAWN")[] }
        order?: { orderNo: { contains: string } }
    } = {
        distributorId: user.id,
    }
    if (filters.statusList.length > 0) {
        where.status = { in: filters.statusList }
    }
    if (filters.search) {
        where.order = { orderNo: { contains: filters.search.trim() } }
    }

    const [commissions, total, statusCounts, settledSum, invitationRewardSum, paidSum, pendingSum, tierSummary, invitationRewards] =
        await Promise.all([
            prisma.commission.findMany({
                where,
                include: { order: { select: { orderNo: true } } },
                orderBy: { createdAt: "desc" },
                skip: (filters.page - 1) * filters.pageSize,
                take: filters.pageSize,
            }),
            prisma.commission.count({ where }),
            prisma.commission.groupBy({
                by: ["status"],
                where: { distributorId: user.id },
                _count: { id: true },
            }),
            prisma.commission.aggregate({
                where: { distributorId: user.id, status: "SETTLED" },
                _sum: { amount: true },
            }),
            prisma.invitationReward.aggregate({
                where: { inviterId: user.id, status: "SETTLED" },
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
            prisma.invitationReward.findMany({
                where: { inviterId: user.id },
                orderBy: { createdAt: "desc" },
                take: 50,
            }),
        ])

    const settledTotal = Number(settledSum._sum.amount ?? 0)
    const invitationRewardTotal = Number(invitationRewardSum._sum.amount ?? 0)
    const paidTotal = Number(paidSum._sum.amount ?? 0)
    const pendingWithdrawalTotal = Number(pendingSum._sum.amount ?? 0)
    const withdrawableBalance = settledTotal + invitationRewardTotal - paidTotal - pendingWithdrawalTotal

    const orderIds = [...new Set(invitationRewards.map((r) => r.orderId))]
    const inviteeIds = [...new Set(invitationRewards.map((r) => r.inviteeId))]
    const [orderNoList, inviteeList] = await Promise.all([
        orderIds.length > 0
            ? prisma.order.findMany({
                  where: { id: { in: orderIds } },
                  select: { id: true, orderNo: true },
              })
            : [],
        inviteeIds.length > 0
            ? prisma.user.findMany({
                  where: { id: { in: inviteeIds } },
                  select: { id: true, name: true, email: true },
              })
            : [],
    ])
    const orderNoMap = new Map(orderNoList.map((o) => [o.id, o.orderNo]))
    const inviteeMap = new Map(
        inviteeList.map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }])
    )

    const commissionStats = {
        PENDING: statusCounts.find((c) => c.status === "PENDING")?._count.id ?? 0,
        SETTLED: statusCounts.find((c) => c.status === "SETTLED")?._count.id ?? 0,
        WITHDRAWN: statusCounts.find((c) => c.status === "WITHDRAWN")?._count.id ?? 0,
    }

    const rows: DistributorCommissionRow[] = commissions.map((c) => ({
        id: c.id,
        orderNo: c.order.orderNo,
        amount: Number(c.amount),
        status: c.status,
        createdAt: c.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">我的佣金</h2>
                <p className="text-muted-foreground">佣金明细与可提现余额</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    使用您本人账号邮箱下单的订单不记佣金。
                </p>
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
                            订单佣金（已结算）¥{settledTotal.toFixed(2)} + 邀请奖励 ¥{invitationRewardTotal.toFixed(2)} − 已打款 ¥{paidTotal.toFixed(2)} − 提现中 ¥{pendingWithdrawalTotal.toFixed(2)} = 可提现余额；申请提现后由管理员线下打款
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="min-h-9 touch-manipulation" asChild>
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
                        minAmount={config.withdrawalMinAmount}
                    />
                </CardContent>
            </Card>

            <div>
                <h3 className="text-lg font-semibold">邀请奖励明细</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    被邀请人首单成交时发放，每名被邀请人仅奖励一次。
                </p>
                {invitationRewards.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4">暂无邀请奖励</p>
                ) : (
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>触发订单号</TableHead>
                                    <TableHead>被邀请人</TableHead>
                                    <TableHead>金额</TableHead>
                                    <TableHead>时间</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invitationRewards.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-mono text-sm">
                                            {orderNoMap.get(r.orderId) ?? r.orderId}
                                        </TableCell>
                                        <TableCell>
                                            {inviteeMap.get(r.inviteeId)?.name ??
                                                inviteeMap.get(r.inviteeId)?.email ??
                                                "—"}
                                        </TableCell>
                                        <TableCell>¥{Number(r.amount).toFixed(2)}</TableCell>
                                        <TableCell>
                                            {new Date(r.createdAt).toLocaleString("zh-CN")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </div>

            <div>
                <h3 className="text-lg font-semibold">佣金明细</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    共 {total} 笔。使用本人账号邮箱下单的订单不记佣金。
                </p>
                <DistributorCommissionsDataTable
                    data={rows}
                    total={total}
                    statusCounts={commissionStats}
                />
            </div>
        </div>
    )
}
