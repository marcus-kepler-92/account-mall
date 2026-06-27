import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getWeekStart } from "@/lib/domains/distributors"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { mapTeamRows } from "./data"

const TEAM_SOFT_LIMIT = 200

export async function TeamTab({ distributorId }: { distributorId: string }) {
    const invitees = await prisma.user.findMany({
        where: { inviterId: distributorId, role: "DISTRIBUTOR" },
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            distributorCode: true,
            createdAt: true,
            disabledAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: TEAM_SOFT_LIMIT,
    })
    const inviteeIds = invitees.map((u) => u.id)

    const weekStart = getWeekStart(new Date())
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

    const tiers = await prisma.commissionTier.findMany({ orderBy: { sortOrder: "asc" } })

    const [level2BySource, weeklyGroups, totalGroups] =
        inviteeIds.length > 0
            ? await Promise.all([
                  prisma.commission.groupBy({
                      by: ["sourceDistributorId"],
                      where: {
                          distributorId,
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
        level2BySource.map((r) => [
            r.sourceDistributorId as string,
            Number(r._sum.amount ?? 0),
        ]),
    )
    const weeklyMap = new Map(
        weeklyGroups.map((g) => [g.distributorId as string, Number(g._sum.amount ?? 0)]),
    )
    const salesMap = new Map(
        totalGroups.map((g) => [g.distributorId as string, Number(g._sum.amount ?? 0)]),
    )
    const orderCountMap = new Map(
        totalGroups.map((g) => [g.distributorId as string, g._count._all]),
    )

    const tiersNormalized = tiers.map((t) => ({
        minAmount: Number(t.minAmount),
        maxAmount: Number(t.maxAmount),
        ratePercent: Number(t.ratePercent),
    }))

    const rows = mapTeamRows(invitees, {
        weekly: weeklyMap,
        sales: salesMap,
        orderCount: orderCountMap,
        level2: level2Map,
        tiers: tiersNormalized,
    })

    if (rows.length === 0) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    暂无下线成员
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardContent className="space-y-3 pt-6">
                {invitees.length >= TEAM_SOFT_LIMIT && (
                    <p className="text-xs text-muted-foreground">
                        仅显示最近 {TEAM_SOFT_LIMIT} 个下线。
                    </p>
                )}
                <div className="overflow-x-auto rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>下线</TableHead>
                                <TableHead>推荐码</TableHead>
                                <TableHead className="text-right">本周销售</TableHead>
                                <TableHead className="text-right">累计销售</TableHead>
                                <TableHead className="text-right">贡献二级佣金</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>加入时间</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>
                                        <Link
                                            href={`/admin/distributors/${r.id}`}
                                            className="hover:underline"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{r.name ?? "—"}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {r.email ?? r.username ?? ""}
                                                </span>
                                            </div>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {r.distributorCode ? (
                                            <code className="text-xs font-mono">
                                                {r.distributorCode}
                                            </code>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="tabular-nums">
                                                {formatCurrency(r.weeklySalesTotal)}
                                            </span>
                                            {r.tierLabel && (
                                                <span className="text-xs text-muted-foreground">
                                                    {r.tierLabel}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="tabular-nums">
                                                {formatCurrency(r.salesTotal)}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {r.completedOrderCount} 单
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-amber-600">
                                        {formatCurrency(r.level2CommissionTotal)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={r.disabled ? "destructive" : "default"}>
                                            {r.disabled ? "已停用" : "启用"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {formatDateTime(r.createdAt)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}
