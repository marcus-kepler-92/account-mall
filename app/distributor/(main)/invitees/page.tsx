import { redirect } from "next/navigation";
import { getDistributorSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Coins } from "lucide-react";
import { InviteesDataTable } from "./invitees-data-table";
import type { InviteeRow } from "./invitees-columns";
import { buildMilestoneCumulativeMap } from "@/lib/milestone-cumulative";
import { computeInviteeTierInfo } from "./invitees-utils";
import { getWeekStart } from "@/lib/domains/distributors";

export const dynamic = "force-dynamic";

export default async function DistributorInviteesPage() {
  const session = await getDistributorSession();
  if (!session) {
    redirect("/distributor/login");
  }

  const user = session.user as { id: string };

  const invitees = await prisma.user.findMany({
    where: { inviterId: user.id },
    select: { id: true, name: true, email: true, username: true, createdAt: true, disabledAt: true },
    orderBy: { createdAt: "desc" },
  });

  const inviteeIds = invitees.map((u) => u.id);

  const weekStart = getWeekStart(new Date())
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const tiers = await prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } })

  const [level2CommissionsBySource, weeklyOrderGroups, totalOrderGroups] =
    inviteeIds.length > 0
      ? await Promise.all([
          prisma.commission.groupBy({
            by: ["sourceDistributorId"],
            where: {
              distributorId: user.id,
              level: 2,
              sourceDistributorId: { in: inviteeIds },
              status: "SETTLED",
            },
            _sum: { amount: true },
          }),
          prisma.order.groupBy({
            by: ["distributorId"],
            where: {
              distributorId: { in: inviteeIds },
              status: "COMPLETED",
              paidAt: { gte: weekStart, lt: weekEnd },
            },
            _sum: { amount: true },
          }),
          prisma.order.groupBy({
            by: ["distributorId"],
            where: { distributorId: { in: inviteeIds }, status: "COMPLETED" },
            _sum: { amount: true },
            _count: { _all: true },
          }),
        ])
      : [[], [], []]

  const level2Map = new Map(
    level2CommissionsBySource.map((r) => [
      r.sourceDistributorId as string,
      Number(r._sum.amount ?? 0),
    ]),
  )

  const weeklyMap = new Map(
    weeklyOrderGroups.map((g) => [g.distributorId as string, Number(g._sum.amount ?? 0)])
  )
  const salesMap = new Map(
    totalOrderGroups.map((g) => [g.distributorId as string, Number(g._sum.amount ?? 0)])
  )
  const orderCountMap = new Map(
    totalOrderGroups.map((g) => [g.distributorId as string, g._count._all])
  )

  const tiersNormalized = tiers.map((t) => ({
    minAmount: Number(t.minAmount),
    maxAmount: Number(t.maxAmount),
    ratePercent: Number(t.ratePercent),
  }))

  const totalLevel2 = level2CommissionsBySource.reduce(
    (sum, r) => sum + Number(r._sum.amount ?? 0),
    0,
  );

  const level2RatePercent = config.level2CommissionRatePercent

  const [milestones, triggeredBonuses] = await Promise.all([
    prisma.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
    prisma.invitationMilestoneBonus.findMany({
      where: { inviterId: user.id },
      select: { milestoneId: true },
    }),
  ])

  const triggeredMilestoneIds = new Set(triggeredBonuses.map((b) => b.milestoneId))
  const triggeredMilestoneCount = triggeredMilestoneIds.size

  const nextMilestone = milestones.find((m) => !triggeredMilestoneIds.has(m.id)) ?? null

  let cumulativeMap: Map<string, number> | null = null
  if (nextMilestone && inviteeIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: { distributorId: { in: inviteeIds }, status: "COMPLETED", paidAt: { gte: nextMilestone.createdAt } },
      select: { distributorId: true, amount: true, email: true },
    })
    cumulativeMap = buildMilestoneCumulativeMap(orders, invitees)
  }

  // Only count active invitees — consistent with checkAndIssueMilestoneBonuses trigger logic
  const qualifiedForNextCount = nextMilestone && cumulativeMap
    ? invitees.filter((u) => !u.disabledAt && (cumulativeMap.get(u.id) ?? 0) >= Number(nextMilestone.thresholdAmount)).length
    : 0

  const rows: InviteeRow[] = invitees.map((u) => {
    const weeklySalesTotal = weeklyMap.get(u.id) ?? 0
    const { tierLabel, nextTierMinAmount } = computeInviteeTierInfo(weeklySalesTotal, tiersNormalized)
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
      createdAt: u.createdAt.toISOString(),
      level2CommissionTotal: level2Map.get(u.id) ?? 0,
      weeklySalesTotal,
      salesTotal: salesMap.get(u.id) ?? 0,
      completedOrderCount: orderCountMap.get(u.id) ?? 0,
      tierLabel,
      nextTierMinAmount,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">我的团队</h1>
        <p className="text-muted-foreground">邀请分销员加入团队，团队成员每成一单，您可获得其佣金的 {level2RatePercent}% 作为团队奖金</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">团队总人数</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{invitees.length}</p>
            <p className="text-xs text-muted-foreground">已加入的分销员</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">团队贡献奖金</CardTitle>
            <Coins className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">¥{totalLevel2.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">团队成员每笔销售佣金的 {level2RatePercent}% 归您</p>
          </CardContent>
        </Card>
      </div>

      <InviteesDataTable
        data={rows}
        level2RatePercent={config.level2CommissionRatePercent}
        milestoneSummary={{
          triggeredCount: triggeredMilestoneCount,
          nextMilestone: nextMilestone
            ? {
                thresholdAmount: Number(nextMilestone.thresholdAmount),
                thresholdCount: nextMilestone.thresholdCount,
                bonusAmount: Number(nextMilestone.bonusAmount),
                qualifiedCount: qualifiedForNextCount,
              }
            : null,
        }}
      />
    </div>
  );
}
