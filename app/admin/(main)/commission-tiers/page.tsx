import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CommissionTiersDataTable } from "./commission-tiers-data-table"
import { AddTierDialog } from "./add-tier-dialog"
import type { TierRow } from "./commission-tiers-columns"

export const dynamic = "force-dynamic"

export default async function AdminCommissionTiersPage() {
    const tiers = await prisma.commissionTier.findMany({
        orderBy: { sortOrder: "asc" },
    })

    const data: TierRow[] = tiers.map((t) => ({
        id: t.id,
        minAmount: Number(t.minAmount),
        maxAmount: Number(t.maxAmount),
        ratePercent: Number(t.ratePercent),
        sortOrder: t.sortOrder,
        createdAt: t.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">阶梯佣金配置</h2>
                    <p className="text-muted-foreground">
                        全局适用，按自然周累计销售额分档，每档按订单金额的百分比计算阶梯佣金。
                    </p>
                </div>
                <AddTierDialog />
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>档位列表</CardTitle>
                    <CardDescription>
                        当周该分销员已完成订单金额落入区间 [下限, 上限) 时，该档阶梯佣金 = 订单金额 × 佣金比例%
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CommissionTiersDataTable data={data} />
                </CardContent>
            </Card>
        </div>
    )
}
