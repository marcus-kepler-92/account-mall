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

  const level2CommissionsBySource =
    inviteeIds.length > 0
      ? await prisma.commission.groupBy({
          by: ["sourceDistributorId"],
          where: {
            distributorId: user.id,
            level: 2,
            sourceDistributorId: { in: inviteeIds },
            status: "SETTLED",
          },
          _sum: { amount: true },
        })
      : [];

  const level2Map = new Map(
    level2CommissionsBySource.map((r) => [
      r.sourceDistributorId as string,
      Number(r._sum.amount ?? 0),
    ]),
  );

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

  const cumulativeMap =
    nextMilestone && inviteeIds.length > 0
      ? new Map(
          (
            await prisma.order.groupBy({
              by: ["distributorId"],
              where: { distributorId: { in: inviteeIds }, status: "COMPLETED", paidAt: { gte: nextMilestone.createdAt } },
              _sum: { amount: true },
            })
          ).map((r) => [r.distributorId, Number(r._sum.amount ?? 0)])
        )
      : null

  // Only count active invitees — consistent with checkAndIssueMilestoneBonuses trigger logic
  const qualifiedForNextCount = nextMilestone && cumulativeMap
    ? invitees.filter((u) => !u.disabledAt && (cumulativeMap.get(u.id) ?? 0) >= Number(nextMilestone.thresholdAmount)).length
    : 0

  const inviteeProgressMap = new Map(
    invitees.map((u) => [
      u.id,
      {
        nextMilestone: cumulativeMap
          ? { thresholdAmount: Number(nextMilestone!.thresholdAmount), bonusAmount: Number(nextMilestone!.bonusAmount), cumulative: cumulativeMap.get(u.id) ?? 0 }
          : null,
      },
    ])
  )

  const rows: InviteeRow[] = invitees.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    createdAt: u.createdAt.toISOString(),
    level2CommissionTotal: level2Map.get(u.id) ?? 0,
    ...(inviteeProgressMap.get(u.id) ?? { nextMilestone: null }),
  }));

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
