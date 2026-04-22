import { redirect } from "next/navigation"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CommissionRateDetail } from "../commission-rate-detail"
import { getDistributorTierSummary, adjustRate } from "@/lib/distributor-tier-summary"
import {
    parseDistributorCommissionFilters,
    type DistributorCommissionFiltersInput,
} from "./commissions-filters"
import { parseServerSort } from "@/lib/table-sort"
import { Suspense } from "react"
import { DistributorCommissionsDataTable } from "./commissions-data-table"
import type { DistributorCommissionRow } from "./commissions-columns"
import { CommissionsBalanceSection } from "./commissions-balance-section"
import { TierProgress } from "../tier-progress"
import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

export default async function DistributorCommissionsPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; pageSize?: string; status?: string; search?: string; sort?: string; sortDir?: string }>
}) {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const user = session.user as { id: string }
    const params = await searchParams
    const filters = parseDistributorCommissionFilters(params as DistributorCommissionFiltersInput)
    const { orderBy } = parseServerSort(
        params.sort ?? null,
        params.sortDir ?? null,
        ["createdAt", "amount"] as const,
        { sort: "createdAt", sortDir: "desc" },
    )

    const statusFilter = filters.statusList.length > 0
        ? { in: filters.statusList }
        : { not: "CANCELLED" as const }

    const where = {
        distributorId: user.id,
        status: statusFilter,
        ...(filters.search ? { order: { orderNo: { contains: filters.search.trim() } } } : {}),
    }
    const level2Rate = config.level2CommissionRatePercent

    const [
        commissions,
        total,
        statusCounts,
        level1Settled,
        level2Settled,
        paidSum,
        pendingSum,
        tierSummary,
        inviteeCount,
    ] = await Promise.all([
        prisma.commission.findMany({
            where,
            include: {
                order: { select: { orderNo: true } },
            },
            orderBy,
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
        prisma.commission.count({ where }),
        prisma.commission.groupBy({
            by: ["status"],
            where: { distributorId: user.id, status: { not: "CANCELLED" } },
            _count: { id: true },
        }),
        prisma.commission.aggregate({
            where: { distributorId: user.id, level: 1, status: "SETTLED" },
            _sum: { amount: true },
        }),
        prisma.commission.aggregate({
            where: { distributorId: user.id, level: 2, status: "SETTLED" },
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
        getDistributorTierSummary(user.id, level2Rate),
        prisma.user.count({ where: { inviterId: user.id } }),
    ])

    const hasInviter = tierSummary.hasInviter
    const level1SettledTotal = Number(level1Settled._sum.amount ?? 0)
    const level2SettledTotal = Number(level2Settled._sum.amount ?? 0)
    const paidTotal = Number(paidSum._sum.amount ?? 0)
    const pendingWithdrawalTotal = Number(pendingSum._sum.amount ?? 0)
    const withdrawableBalance =
        level1SettledTotal + level2SettledTotal - paidTotal - pendingWithdrawalTotal

    // Fetch sourceDistributor names for level-2 commissions
    const sourceDistributorIds = [
        ...new Set(
            commissions
                .filter((c) => c.level === 2 && c.sourceDistributorId)
                .map((c) => c.sourceDistributorId as string),
        ),
    ]
    const sourceDistributors =
        sourceDistributorIds.length > 0
            ? await prisma.user.findMany({
                  where: { id: { in: sourceDistributorIds } },
                  select: { id: true, name: true },
              })
            : []
    const sourceDistributorMap = new Map(sourceDistributors.map((u) => [u.id, u.name]))

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
        level: (c.level ?? 1) as 1 | 2,
        sourceDistributorName: c.sourceDistributorId
            ? (sourceDistributorMap.get(c.sourceDistributorId) ?? undefined)
            : undefined,
        createdAt: c.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">我的奖金</h2>
                <p className="text-muted-foreground">奖金明细与可提现余额</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    使用您本人账号邮箱下单的订单不记奖金。
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>当周业绩与阶梯</CardTitle>
                    <CardDescription>
                        当周累计销售额 ¥{tierSummary.weeklySalesTotal.toFixed(2)}
                        {tierSummary.currentTier
                            ? ` · 当前第 ${tierSummary.currentTier.sortOrder + 1} 档，奖金比例 ${adjustRate(tierSummary.currentTier.ratePercent, level2Rate, hasInviter)}%`
                            : " · 暂无档位"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {tierSummary.nextTier && (
                    <TierProgress
                        weeklySalesTotal={tierSummary.weeklySalesTotal}
                        nextTierMinAmount={tierSummary.nextTier.minAmount}
                    />
                )}
                <p className="text-muted-foreground text-sm">{tierSummary.encouragementMessage}</p>
                    {(tierSummary.currentTier ?? tierSummary.nextTier) && (() => {
                        const displayTier = tierSummary.currentTier ?? tierSummary.nextTier!
                        const rate = displayTier.ratePercent
                        return (
                            <CommissionRateDetail
                                myRate={adjustRate(rate, level2Rate, hasInviter)}
                                tierRate={rate}
                                level2Rate={level2Rate}
                                hasInviter={hasInviter}
                            />
                        )
                    })()}
                </CardContent>
            </Card>

            <CommissionsBalanceSection
                level1Settled={level1SettledTotal}
                level2Settled={level2SettledTotal}
                paidTotal={paidTotal}
                pendingTotal={pendingWithdrawalTotal}
                withdrawableBalance={withdrawableBalance}
                inviteeCount={inviteeCount}
                minAmount={config.withdrawalMinAmount}
                feePercent={config.withdrawalFeePercent}
            />

            <div>
                <h3 className="text-lg font-semibold">奖金明细</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    共 {total} 笔。使用本人账号邮箱下单的订单不记奖金。
                </p>
                <Suspense fallback={null}>
                    <DistributorCommissionsDataTable
                        data={rows}
                        total={total}
                        statusCounts={commissionStats}
                    />
                </Suspense>
            </div>
        </div>
    )
}
