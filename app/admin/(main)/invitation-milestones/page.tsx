import { listInvitationMilestones } from "@/lib/domains/distributors"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/app/admin/components"
import { InvitationMilestonesDataTable } from "./invitation-milestones-data-table"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import type { MilestoneRow } from "./invitation-milestones-columns"

export const dynamic = "force-dynamic"

export default async function InvitationMilestonesPage() {
    const milestones = await listInvitationMilestones()

    const data: MilestoneRow[] = milestones.map((m) => ({
        id: m.id,
        thresholdAmount: m.thresholdAmount,
        thresholdCount: m.thresholdCount,
        bonusAmount: m.bonusAmount,
        sortOrder: m.sortOrder,
        createdAt: m.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="邀请里程碑奖励"
                description="当被邀请人的累计销售额（自里程碑创建日起）达到门槛时，邀请人一次性获得对应奖励。每档每人仅触发一次。"
            >
                <AddMilestoneDialog />
            </PageHeader>
            <Card>
                <CardHeader>
                    <CardTitle>里程碑档位</CardTitle>
                    <CardDescription>
                        当 N 位下线各自累计消费满指定金额时触发。创建时间为起算日，此前消费不计入。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <InvitationMilestonesDataTable data={data} />
                </CardContent>
            </Card>
        </div>
    )
}
