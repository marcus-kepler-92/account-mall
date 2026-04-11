import { redirect } from "next/navigation";
import Link from "next/link";
import { getDistributorSession } from "@/lib/auth-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, BookOpen, ChevronRight, Link2 } from "lucide-react";
import { CopyButtonClient } from "@/app/components/copy-promo-button";
import { CommissionRateDetail } from "./commission-rate-detail";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { getDistributorTierSummary, adjustRate } from "@/lib/distributor-tier-summary";
import { DashboardKpiSection } from "./dashboard-kpi-section"
import { TierProgress } from "./tier-progress";

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
  ]);

  const hasInviter = tierSummary.hasInviter;

  const level1Total = Number(level1Sum._sum.amount ?? 0);
  const level2Total = Number(level2Sum._sum.amount ?? 0);
  const level1Settled = Number(
    (
      await prisma.commission.aggregate({
        where: { distributorId: user.id, level: 1, status: "SETTLED" },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0,
  );
  const level2Settled = Number(
    (
      await prisma.commission.aggregate({
        where: { distributorId: user.id, level: 2, status: "SETTLED" },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0,
  );
  const paidTotal = Number(paidSum._sum.amount ?? 0);
  const pendingTotal = Number(pendingSum._sum.amount ?? 0);
  const withdrawableBalance =
    level1Settled + level2Settled - paidTotal - pendingTotal;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">总览</h1>

      {/* 入门手册 — 醒目引导 */}
      <Link
        href="/distributor/guide"
        className="flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground transition-opacity hover:opacity-90"
      >
        <BookOpen className="size-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">新手必读：入门手册</p>
          <p className="text-xs opacity-80">了解如何推广赚取佣金</p>
        </div>
        <ChevronRight className="size-4 shrink-0" />
      </Link>

      {/* 当周业绩与阶梯 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="size-4" />
            当周业绩与阶梯
          </CardTitle>
          <CardDescription>
            按自然周累计销售额确定当前档位，阶梯奖金 = 订单金额 × 该档奖金比例%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">当周累计销售额</p>
            <p className="text-2xl font-bold">
              ¥{tierSummary.weeklySalesTotal.toFixed(2)}
            </p>
          </div>
          {(tierSummary.currentTier ?? tierSummary.nextTier) && (() => {
            const displayTier = tierSummary.currentTier ?? tierSummary.nextTier!;
            const rate = displayTier.ratePercent;
            return (
              <div className="space-y-2">
                {tierSummary.currentTier && (
                  <p className="text-xs text-muted-foreground">
                    第 {tierSummary.currentTier.sortOrder + 1} 档 · 区间 ¥{tierSummary.currentTier.minAmount.toFixed(2)} – ¥{tierSummary.currentTier.maxAmount.toFixed(2)}
                  </p>
                )}
                <CommissionRateDetail
                  myRate={adjustRate(rate, level2Rate, hasInviter)}
                  tierRate={rate}
                  level2Rate={level2Rate}
                  hasInviter={hasInviter}
                />
              </div>
            );
          })()}
          {tierSummary.nextTier && (
            <TierProgress
              weeklySalesTotal={tierSummary.weeklySalesTotal}
              nextTierMinAmount={tierSummary.nextTier.minAmount}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {tierSummary.encouragementMessage}
          </p>
        </CardContent>
      </Card>

      {/* 推广链接 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4 text-primary" />
            推广链接
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <code className="flex-1 min-w-0 truncate rounded bg-muted px-3 py-2 text-xs sm:text-sm">
            {promoUrl}
          </code>
          <CopyButtonClient text={promoUrl} successMessage="推广链接已复制到剪贴板" />
        </CardContent>
      </Card>

      {/* KPI */}
      <DashboardKpiSection
        orderCount={orderCount}
        level1CommissionTotal={level1Total}
        level2CommissionTotal={level2Total}
        withdrawableBalance={withdrawableBalance}
        pendingWithdrawalTotal={pendingTotal}
        inviteeCount={inviteeCount}
        distributorCode={distributorCode}
        discountCodeEnabled={selfUser?.discountCodeEnabled ?? false}
        discountPercent={selfUser?.discountPercent != null ? Number(selfUser.discountPercent) : null}
      />
    </div>
  );
}
