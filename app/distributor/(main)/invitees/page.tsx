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
    select: { id: true, name: true, email: true, createdAt: true },
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

  const rows: InviteeRow[] = invitees.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    level2CommissionTotal: level2Map.get(u.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">我的下线</h1>
        <p className="text-muted-foreground">已邀请加入的分销员列表</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">下线总人数</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{invitees.length}</p>
            <p className="text-xs text-muted-foreground">已加入的分销员</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">下线带来的二级佣金</CardTitle>
            <Coins className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">¥{totalLevel2.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">累计已结算</p>
          </CardContent>
        </Card>
      </div>

      <InviteesDataTable data={rows} level2RatePercent={config.level2CommissionRatePercent} />
    </div>
  );
}
