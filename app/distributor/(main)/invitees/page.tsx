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

  // Get level-2 commissions grouped by sourceDistributorId for current user
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

  // Fetch milestones and triggered bonuses for progress display
  const [milestones, triggeredBonuses] = await Promise.all([
    prisma.invitationMilestone.findMany({ orderBy: { thresholdAmount: "asc" } }),
    inviteeIds.length > 0
      ? prisma.invitationMilestoneBonus.findMany({
          where: { inviterId: user.id, inviteeId: { in: inviteeIds } },
          select: { inviteeId: true, milestoneId: true },
        })
      : Promise.resolve([]),
  ])

  // Group triggered bonuses by invitee
  const triggeredByInvitee = new Map<string, Set<string>>()
  for (const b of triggeredBonuses) {
    if (!triggeredByInvitee.has(b.inviteeId)) triggeredByInvitee.set(b.inviteeId, new Set())
    triggeredByInvitee.get(b.inviteeId)!.add(b.milestoneId)
  }

  // For each invitee, find their next unclaimed milestone and cumulative sales
  const inviteeProgressMap = new Map<string, {
    nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null
    triggeredMilestoneCount: number
  }>()

  if (milestones.length > 0) {
    await Promise.all(
      invitees.map(async (invitee) => {
        const triggered = triggeredByInvitee.get(invitee.id) ?? new Set<string>()
        const triggeredMilestoneCount = triggered.size
        const nextMilestoneConfig = milestones.find((m) => !triggered.has(m.id))

        let nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null = null
        if (nextMilestoneConfig) {
          const { _sum } = await prisma.order.aggregate({
            where: {
              distributorId: invitee.id,
              status: "COMPLETED",
              paidAt: { gte: nextMilestoneConfig.createdAt },
            },
            _sum: { amount: true },
          })
          nextMilestone = {
            thresholdAmount: Number(nextMilestoneConfig.thresholdAmount),
            bonusAmount: Number(nextMilestoneConfig.bonusAmount),
            cumulative: Number(_sum.amount ?? 0),
          }
        }
        inviteeProgressMap.set(invitee.id, { nextMilestone, triggeredMilestoneCount })
      }),
    )
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
