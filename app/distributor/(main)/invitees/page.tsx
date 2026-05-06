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
    select: { id: true, name: true, email: true, username: true, createdAt: true },
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
    inviteeIds.length > 0
      ? prisma.invitationMilestoneBonus.findMany({
          where: { inviterId: user.id, inviteeId: { in: inviteeIds } },
          select: { inviteeId: true, milestoneId: true },
        })
      : Promise.resolve([]),
  ])

  const triggeredByInvitee = new Map<string, Set<string>>()
  for (const b of triggeredBonuses) {
    if (!triggeredByInvitee.has(b.inviteeId)) triggeredByInvitee.set(b.inviteeId, new Set())
    triggeredByInvitee.get(b.inviteeId)!.add(b.milestoneId)
  }

  const inviteeProgressMap = new Map<string, {
    nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null
    triggeredMilestoneCount: number
  }>()

  if (milestones.length > 0) {
    const milestoneToInvitees = new Map<string, typeof invitees>()
    const inviteeToMilestone = new Map<string, typeof milestones[number]>()
    const inviteeTriggeredCount = new Map<string, number>()

    for (const invitee of invitees) {
      const triggered = triggeredByInvitee.get(invitee.id) ?? new Set<string>()
      inviteeTriggeredCount.set(invitee.id, triggered.size)
      const next = milestones.find((m) => !triggered.has(m.id))
      if (next) {
        inviteeToMilestone.set(invitee.id, next)
        if (!milestoneToInvitees.has(next.id)) milestoneToInvitees.set(next.id, [])
        milestoneToInvitees.get(next.id)!.push(invitee)
      }
    }

    await Promise.all(
      [...milestoneToInvitees.entries()].map(async ([milestoneId, group]) => {
        const milestone = milestones.find((m) => m.id === milestoneId)!
        const ids = group.map((u) => u.id)
        const results = await prisma.order.groupBy({
          by: ["distributorId"],
          where: { distributorId: { in: ids }, status: "COMPLETED", paidAt: { gte: milestone.createdAt } },
          _sum: { amount: true },
        })
        const cumulativeMap = new Map(results.map((r) => [r.distributorId, Number(r._sum.amount ?? 0)]))
        for (const invitee of group) {
          inviteeProgressMap.set(invitee.id, {
            nextMilestone: {
              thresholdAmount: Number(milestone.thresholdAmount),
              bonusAmount: Number(milestone.bonusAmount),
              cumulative: cumulativeMap.get(invitee.id) ?? 0,
            },
            triggeredMilestoneCount: inviteeTriggeredCount.get(invitee.id) ?? 0,
          })
        }
      }),
    )

    for (const invitee of invitees) {
      if (!inviteeProgressMap.has(invitee.id)) {
        inviteeProgressMap.set(invitee.id, {
          nextMilestone: null,
          triggeredMilestoneCount: inviteeTriggeredCount.get(invitee.id) ?? 0,
        })
      }
    }
  }

  const rows: InviteeRow[] = invitees.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    createdAt: u.createdAt.toISOString(),
    level2CommissionTotal: level2Map.get(u.id) ?? 0,
    ...(inviteeProgressMap.get(u.id) ?? { nextMilestone: null, triggeredMilestoneCount: 0 }),
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

      <InviteesDataTable data={rows} level2RatePercent={config.level2CommissionRatePercent} />
    </div>
  );
}
