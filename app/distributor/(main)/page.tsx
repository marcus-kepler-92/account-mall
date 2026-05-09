import { redirect } from "next/navigation";
import Link from "next/link";
import { getDistributorSession } from "@/lib/auth-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Link2, Tag, Wallet, BookOpen } from "lucide-react";
import { CopyButtonClient } from "@/app/components/copy-promo-button";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { getDistributorTierSummary, adjustRate } from "@/lib/distributor-tier-summary";
import { DashboardKpiSection } from "./dashboard-kpi-section";
import { TierProgress } from "./tier-progress";
import { MilestoneCard } from "./milestone-card";

export const dynamic = "force-dynamic";

export default async function DistributorDashboardPage() {
  const session = await getDistributorSession();
  if (!session) {
    redirect("/distributor/login");
  }

  const user = session.user as {
    id: string;
    email?: string;
    name?: string;
    distributorCode?: string | null;
  };
  let distributorCode = user.distributorCode;

  if (!distributorCode) {
    const code = `D${user.id.slice(-8).toUpperCase()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { distributorCode: code },
    });
    distributorCode = code;
  }

  const promoUrl = `${config.siteUrl}/?promoCode=${encodeURIComponent(distributorCode)}`;

  const level2Rate = config.level2CommissionRatePercent;

  const [
    orderCount,
    level1Sum,
    level2Sum,
    paidSum,
    pendingSum,
    tierSummary,
    inviteeCount,
    selfUser,
    milestoneBonuses,
    level1SettledAgg,
    level2SettledAgg,
    allMilestones,
    activeInvitees,
  ] = await Promise.all([
    prisma.order.count({
      where: { distributorId: user.id, status: "COMPLETED" },
    }),
    prisma.commission.aggregate({
      where: { distributorId: user.id, level: 1 },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { distributorId: user.id, level: 2 },
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
    prisma.user.findUnique({
      where: { id: user.id },
      select: { discountCodeEnabled: true, discountPercent: true },
    }),
    prisma.invitationMilestoneBonus.findMany({
      where: { inviterId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commission.aggregate({
      where: { distributorId: user.id, level: 1, status: "SETTLED" },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { distributorId: user.id, level: 2, status: "SETTLED" },
      _sum: { amount: true },
    }),
    prisma.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
    prisma.user.findMany({
      where: { inviterId: user.id, disabledAt: null },
      select: { id: true, name: true },
    }),
  ]);

  const hasInviter = tierSummary.hasInviter;

  const level1Total = Number(level1Sum._sum.amount ?? 0);
  const level2Total = Number(level2Sum._sum.amount ?? 0);
  const level1Settled = Number(level1SettledAgg._sum.amount ?? 0);
  const level2Settled = Number(level2SettledAgg._sum.amount ?? 0);
  const milestoneBonusTotal = milestoneBonuses.reduce((sum, b) => sum + Number(b.amount), 0);
  const paidTotal = Number(paidSum._sum.amount ?? 0);
  const pendingTotal = Number(pendingSum._sum.amount ?? 0);
  const withdrawableBalance =
    level1Settled + level2Settled + milestoneBonusTotal - paidTotal - pendingTotal;

  const triggeredMilestoneIds = new Set(milestoneBonuses.map((b) => b.milestoneId))
  const activeInviteeIds = activeInvitees.map((u) => u.id)
  const untriggeredMilestones = allMilestones.filter((m) => !triggeredMilestoneIds.has(m.id))
  const milestoneInviteeProgress =
    activeInviteeIds.length > 0 && untriggeredMilestones.length > 0
      ? await Promise.all(
          untriggeredMilestones.map(async (m) => {
            const data = await prisma.order.groupBy({
              by: ["distributorId"],
              where: {
                distributorId: { in: activeInviteeIds },
                status: "COMPLETED",
                paidAt: { gte: m.createdAt },
              },
              _sum: { amount: true },
            })
            const cumulativeMap = new Map(data.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))
            const threshold = Number(m.thresholdAmount)
            const allProgress = activeInvitees
              .map((u) => ({
                id: u.id,
                name: u.name,
                cumulative: cumulativeMap.get(u.id) ?? 0,
                qualified: (cumulativeMap.get(u.id) ?? 0) >= threshold,
              }))
              .sort((a, b) => b.cumulative - a.cumulative)
            return {
              milestoneId: m.id,
              qualifiedCount: allProgress.filter((u) => u.qualified).length,
              topInvitees: allProgress.slice(0, m.thresholdCount),
            }
          })
        )
      : []

  const inviteeProgressByMilestone = new Map(milestoneInviteeProgress.map((r) => [r.milestoneId, r]))

  const milestoneCardData = allMilestones.map((m) => {
    const triggered = triggeredMilestoneIds.has(m.id)
    const triggeredBonus = milestoneBonuses.find((b) => b.milestoneId === m.id)
    const progress = inviteeProgressByMilestone.get(m.id)
    return {
      milestoneId: m.id,
      thresholdCount: m.thresholdCount,
      thresholdAmount: Number(m.thresholdAmount),
      bonusAmount: Number(m.bonusAmount),
      triggered,
      triggeredBonus: triggeredBonus
        ? {
            countSnapshot: triggeredBonus.countSnapshot,
            thresholdSnapshot: Number(triggeredBonus.thresholdSnapshot),
            amount: Number(triggeredBonus.amount),
            createdAt: triggeredBonus.createdAt.toISOString(),
          }
        : undefined,
      qualifiedCount: progress?.qualifiedCount ?? 0,
      topInvitees: progress?.topInvitees ?? [],
      hasInvitees: activeInvitees.length > 0,
    }
  })

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">总览</h1>

      {/* 入门手册：最高优先级 */}
      <Link href="/distributor/guide" className="block">
        <Card className="py-0 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="size-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">入门手册</p>
                  <p className="text-xs opacity-80 mt-0.5">了解奖金规则与推广技巧</p>
                </div>
              </div>
              <span className="text-sm opacity-80">→</span>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 推广工具：行动入口，首位 */}
      <Card className="py-0">
        <CardContent className="pt-4 pb-4">
          {/* 推广链接 */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Link2 className="size-3.5" />
              推广链接
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate rounded bg-muted px-2.5 py-1.5 text-xs">
                {promoUrl}
              </code>
              <CopyButtonClient text={promoUrl} successMessage="推广链接已复制到剪贴板" />
            </div>
          </div>
          <div className="border-t" />
          {/* 邀请码 */}
          <div className="mt-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Tag className="size-3.5" />
              邀请码
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl font-mono font-bold tracking-widest">
                  {distributorCode}
                </span>
                {selfUser?.discountCodeEnabled && (
                  <Badge variant="success" className="text-xs">
                    优惠{selfUser.discountPercent != null ? ` ${Number(selfUser.discountPercent)}%` : ""}
                  </Badge>
                )}
              </div>
              <CopyButtonClient
                text={distributorCode}
                label="复制"
                successMessage="邀请码已复制"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground shrink-0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 可提现余额：核心财务数字 */}
      <Card className="py-0">
        <CardContent className="pt-5 pb-5">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
            <Wallet className="size-3.5" />
            可提现余额
          </p>
          <p className="text-3xl font-bold tabular-nums">
            ¥{withdrawableBalance.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {pendingTotal > 0 ? `另有 ¥${pendingTotal.toFixed(2)} 提现处理中` : "可申请提现"}
          </p>
        </CardContent>
      </Card>

      {/* 当周业绩与阶梯：两段式，销售额 + 奖金比例 */}
      <Card className="py-0">
        <CardContent className="pt-4 pb-4">
          {/* 上段：销售额与进度 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="size-3.5" />
                当周销售额
              </p>
              {tierSummary.currentTier && (
                <Badge variant="outline" className="text-xs font-normal">
                  第 {tierSummary.currentTier.sortOrder + 1} 档
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold tabular-nums">
              ¥{tierSummary.weeklySalesTotal.toFixed(2)}
            </p>
            {tierSummary.nextTier && (
              <TierProgress
                weeklySalesTotal={tierSummary.weeklySalesTotal}
                nextTierMinAmount={tierSummary.nextTier.minAmount}
              />
            )}
            <p className="text-xs text-muted-foreground">{tierSummary.encouragementMessage}</p>
          </div>

          {/* 下段：奖金比例（有档位才显示）*/}
          {(tierSummary.currentTier ?? tierSummary.nextTier) && (() => {
            const displayTier = tierSummary.currentTier ?? tierSummary.nextTier!;
            const myRate = adjustRate(displayTier.ratePercent, level2Rate, hasInviter);
            return (
              <>
                <div className="border-t my-3" />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {tierSummary.currentTier ? "当前" : "下档"}奖金比例
                  </p>
                  <p className="text-2xl font-bold tabular-nums">{myRate}%</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  每 ¥100 销售额到手 ¥{myRate.toFixed(2)}
                </p>
              </>
            );
          })()}
        </CardContent>
      </Card>

      {/* 邀请里程碑 */}
      {milestoneCardData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">邀请里程碑</p>
            <Link
              href="/distributor/invitees"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              管理团队 →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {milestoneCardData.map((card) => (
              <MilestoneCard key={card.milestoneId} {...card} />
            ))}
          </div>
        </div>
      )}

      {/* 历史数据 */}
      <DashboardKpiSection
        orderCount={orderCount}
        level1CommissionTotal={level1Total}
        level2CommissionTotal={level2Total}
        inviteeCount={inviteeCount}
      />
    </div>
  );
}
