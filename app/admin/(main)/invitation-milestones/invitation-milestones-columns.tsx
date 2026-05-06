"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { InvitationMilestoneRowActions } from "./invitation-milestones-row-actions"

export type MilestoneRow = {
    id: string
    thresholdAmount: number
    bonusAmount: number
    sortOrder: number
    createdAt: string
}

export const invitationMilestonesColumns: ColumnDef<MilestoneRow>[] = [
    {
        accessorKey: "thresholdAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="被邀请人累计销售额门槛" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.original.thresholdAmount)}</div>
        ),
    },
    {
        accessorKey: "bonusAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="邀请人获得奖励" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium text-green-600">
                +{formatCurrency(row.original.bonusAmount)}
            </div>
        ),
    },
    {
        accessorKey: "createdAt",
        header: "创建时间（销售额起算日）",
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {new Date(row.original.createdAt).toLocaleDateString("zh-CN")}
            </span>
        ),
    },
    {
        id: "actions",
        header: () => <div className="w-[80px]">操作</div>,
        cell: ({ row }) => (
            <InvitationMilestoneRowActions
                id={row.original.id}
                thresholdAmount={row.original.thresholdAmount}
                bonusAmount={row.original.bonusAmount}
            />
        ),
    },
]
