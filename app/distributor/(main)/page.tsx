import { redirect } from "next/navigation";
import { getDistributorSession } from "@/lib/auth-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link2, TrendingUp } from "lucide-react";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { CopyButtonClient } from "@/app/components/copy-promo-button";
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary";
import { DashboardKpiSection } from "./dashboard-kpi-section";

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
    getDistributorTierSummary(user.id),
    prisma.user.count({ where: { inviterId: user.id } }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { inviterId: true },
    }),
  ]);

  const hasInviter = !!selfUser?.inviterId;
  const level2Rate = config.level2CommissionRatePercent;

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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">仪表盘</h1>
        <p className="text-muted-foreground">推广链接与数据概览</p>
      </div>

      <DashboardKpiSection
        orderCount={orderCount}
        level1CommissionTotal={level1Total}
        level2CommissionTotal={level2Total}
        withdrawableBalance={withdrawableBalance}
        pendingWithdrawalTotal={pendingTotal}
        distributorCode={distributorCode}
        inviteeCount={inviteeCount}
      />

      {/* 当周业绩与阶梯 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            当周业绩与阶梯
          </CardTitle>
          <CardDescription>
            按自然周累计销售额确定当前档位，阶梯佣金 = 订单金额 × 该档佣金比例%
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">当周累计销售额</p>
            <p className="text-2xl font-bold">
              ¥{tierSummary.weeklySalesTotal.toFixed(2)}
            </p>
          </div>
          {tierSummary.currentTier && (() => {
            const rate = tierSummary.currentTier!.ratePercent;
            const myRate = hasInviter
              ? Math.round(rate * (1 - level2Rate / 100) * 100) / 100
              : rate;
            return (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    第 {tierSummary.currentTier!.sortOrder + 1} 档 · 区间 ¥{tierSummary.currentTier!.minAmount.toFixed(2)} – ¥{tierSummary.currentTier!.maxAmount.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-1">您的实际佣金比例</p>
                  <p className="text-3xl font-bold tabular-nums">{myRate}%</p>
                  {hasInviter ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      阶梯 {rate}%，上线抽 {level2Rate}% 后实得 {myRate}% · 每 ¥100 到手 ¥{(100 * myRate / 100).toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      无上线，全额归您 · 每 ¥100 到手 ¥{(100 * myRate / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          <p className="text-sm text-muted-foreground">
            {tierSummary.encouragementMessage}
          </p>
        </CardContent>
      </Card>

      {/* 整站推广链接 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            整站推广链接
          </CardTitle>
          <CardDescription>
            复制即用，链接已含您的推广优惠码，访客通过此链接下单将归属您的佣金。使用您本人账号邮箱下单的订单不记佣金。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 rounded bg-muted px-3 py-2 text-sm break-all">
              {promoUrl}
            </code>
            <CopyButtonClient text={promoUrl} successMessage="推广链接已复制到剪贴板" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
