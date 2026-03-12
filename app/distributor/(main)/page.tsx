import { redirect } from "next/navigation";
import { getDistributorSession } from "@/lib/auth-guard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link2, ShoppingCart, Coins, Wallet, TrendingUp } from "lucide-react";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { CopyButtonClient } from "@/app/components/copy-promo-button";
import { getDistributorTierSummary } from "@/lib/distributor-tier-summary";

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

  // Ensure distributor has a code (generate if null)
  if (!distributorCode) {
    const code = `D${user.id.slice(-8).toUpperCase()}`;
    await prisma.user.update({
      where: { id: user.id },
      data: { distributorCode: code },
    });
    distributorCode = code;
  }

  const promoUrl = `${config.siteUrl}/?promoCode=${encodeURIComponent(distributorCode)}`;

  const inviteUrl = `${config.siteUrl}/distributor/register?inviteCode=${encodeURIComponent(distributorCode)}`;
  const invitationRewardAmount = config.invitationRewardAmount ?? 5;

  const [
    orderCount,
    commissionTotal,
    settledSum,
    invitationRewardSum,
    paidSum,
    pendingSum,
    tierSummary,
    inviteeCount,
  ] = await Promise.all([
    prisma.order.count({
      where: { distributorId: user.id, status: "COMPLETED" },
    }),
    prisma.commission.aggregate({
      where: { distributorId: user.id },
      _sum: { amount: true },
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
    prisma.user.count({ where: { inviterId: user.id } }),
  ]);
  const withdrawableBalance =
    Number(settledSum._sum.amount ?? 0) +
    Number(invitationRewardSum._sum.amount ?? 0) -
    Number(paidSum._sum.amount ?? 0) -
    Number(pendingSum._sum.amount ?? 0);
  const pendingWithdrawalTotal = Number(pendingSum._sum.amount ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">仪表盘</h1>
        <p className="text-muted-foreground">推广链接与数据概览</p>
      </div>

      {/* 邀请分销员 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="size-5" />
            邀请分销员
          </CardTitle>
          <CardDescription>
            分享下方链接，好友注册成为分销员后，当其首单成交时您将获得¥{invitationRewardAmount} 邀请奖励（每名被邀请人仅奖励一次）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 rounded bg-muted px-3 py-2 text-sm break-all">
              {inviteUrl}
            </code>
            <CopyButtonClient url={inviteUrl} />
          </div>
          {inviteeCount > 0 && (
            <p className="text-sm text-muted-foreground">已邀请 {inviteeCount} 人</p>
          )}
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
            <CopyButtonClient url={promoUrl} />
          </div>
        </CardContent>
      </Card>

      {/* KPI 卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">成交订单数</CardTitle>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{orderCount}</p>
            <p className="text-xs text-muted-foreground">已完成订单</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">累计佣金</CardTitle>
            <Coins className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ¥{Number(commissionTotal._sum.amount ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">已结算 + 待结算</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">可提现余额</CardTitle>
            <Wallet className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ¥{withdrawableBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pendingWithdrawalTotal > 0
                ? `可申请提现 · 提现中 ¥${pendingWithdrawalTotal.toFixed(2)}`
                : "可申请提现"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">推广优惠码</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-mono font-bold">{distributorCode}</p>
          </CardContent>
        </Card>
      </div>

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
          {tierSummary.currentTier && (
            <div>
              <p className="text-sm text-muted-foreground">当前档位</p>
              <p className="font-medium">
                第 {tierSummary.currentTier.sortOrder + 1} 档，阶梯佣金比例{" "}
                {tierSummary.currentTier.ratePercent}%
              </p>
              <p className="text-xs text-muted-foreground">
                区间 ¥{tierSummary.currentTier.minAmount.toFixed(2)} – ¥
                {tierSummary.currentTier.maxAmount.toFixed(2)}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {tierSummary.encouragementMessage}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
