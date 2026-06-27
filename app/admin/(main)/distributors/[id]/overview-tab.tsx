import { notFound } from "next/navigation"
import Link from "next/link"
import { TrendingUp, Coins, Wallet, Users } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatCard } from "@/app/admin/components"
import { formatCurrency } from "@/lib/utils"
import { getDistributorDetailBase } from "@/lib/domains/distributors"
import { getCurrentTier } from "./data"

export async function OverviewTab({ distributorId }: { distributorId: string }) {
    const base = await getDistributorDetailBase(distributorId)
    if (!base) notFound()
    const { row, tiers } = base

    const tierResult = getCurrentTier(row.weeklySalesTotal, tiers)
    const nextTier = tierResult ? tiers[tierResult.index + 1] : null

    return (
        <div className="space-y-6">
            {/* KPI 概览 — 唯一显示主数字的地方 */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="累计销售额"
                    value={formatCurrency(row.salesTotal)}
                    hint={`${row.completedOrderCount} 单`}
                    icon={TrendingUp}
                    borderColor="border-l-primary"
                    iconColor="text-primary"
                />
                <StatCard
                    label="累计佣金"
                    value={formatCurrency(row.totalCommission)}
                    icon={Coins}
                    borderColor="border-l-warning"
                    iconColor="text-warning"
                />
                <StatCard
                    label="可提现余额"
                    value={formatCurrency(row.withdrawableBalance)}
                    icon={Wallet}
                    borderColor="border-l-success"
                    iconColor="text-success"
                />
                <StatCard
                    label="下线人数"
                    value={row.inviteeCount}
                    icon={Users}
                    borderColor="border-l-muted-foreground"
                    iconColor="text-muted-foreground"
                />
            </div>

            {/* 拆解卡 — 只展开 KPI 背后的明细，不重复主数字 */}
            <div className="grid gap-4 md:grid-cols-2">
                {tiers.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">本周阶梯</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <Row
                                label="当前档位"
                                value={
                                    tierResult
                                        ? `第 ${tierResult.index + 1} 档 · ${tierResult.tier.ratePercent}%`
                                        : "—"
                                }
                            />
                            <Row label="本周销售额" value={formatCurrency(row.weeklySalesTotal)} />
                            {nextTier && (
                                <Row
                                    label="距下一档"
                                    value={formatCurrency(nextTier.minAmount - row.weeklySalesTotal)}
                                    muted
                                />
                            )}
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">佣金构成</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <Row label="一级佣金" value={formatCurrency(row.level1CommissionTotal)} />
                        <Row label="二级佣金" value={formatCurrency(row.level2CommissionTotal)} />
                        <TabLink distributorId={distributorId} tab="commissions" label="查看佣金明细 →" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">余额拆解</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <Row label="已结算（一级）" value={formatCurrency(row.level1Settled)} />
                        <Row label="已结算（二级）" value={formatCurrency(row.level2Settled)} />
                        <Row label="已打款" value={formatCurrency(row.paidTotal)} />
                        {row.pendingTotal > 0 && (
                            <Row label="提现中" value={formatCurrency(row.pendingTotal)} />
                        )}
                        <TabLink distributorId={distributorId} tab="withdrawals" label="查看提现记录 →" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">团队与里程碑</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">上线</span>
                            <span>
                                {row.inviter
                                    ? `${row.inviter.name}${row.inviter.distributorCode ? ` (${row.inviter.distributorCode})` : ""}`
                                    : "—"}
                            </span>
                        </div>
                        <Row label="下线人数" value={`${row.inviteeCount} 人`} />
                        {row.milestoneSummary && (
                            <>
                                <Row
                                    label="里程碑已触发"
                                    value={`${row.milestoneSummary.triggeredCount} 个`}
                                />
                                {row.milestoneSummary.nextMilestone ? (
                                    <Row
                                        label="下一档目标"
                                        value={`${row.milestoneSummary.nextMilestone.thresholdCount} 人各满 ¥${row.milestoneSummary.nextMilestone.thresholdAmount.toFixed(0)}`}
                                        muted
                                    />
                                ) : (
                                    <p className="text-xs text-muted-foreground text-right">
                                        已完成所有里程碑
                                    </p>
                                )}
                            </>
                        )}
                        <TabLink distributorId={distributorId} tab="team" label="查看团队明细 →" />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className={`flex justify-between ${muted ? "text-xs text-muted-foreground" : ""}`}>
            <span className={muted ? "" : "text-muted-foreground"}>{label}</span>
            <span className={muted ? "tabular-nums" : "font-medium tabular-nums"}>{value}</span>
        </div>
    )
}

function TabLink({
    distributorId,
    tab,
    label,
}: {
    distributorId: string
    tab: string
    label: string
}) {
    return (
        <Link
            href={`/admin/distributors/${distributorId}?tab=${tab}`}
            className="block text-xs text-primary hover:underline pt-1"
        >
            {label}
        </Link>
    )
}
