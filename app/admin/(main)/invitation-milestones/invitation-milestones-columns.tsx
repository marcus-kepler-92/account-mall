"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { InvitationMilestoneRowActions } from "./invitation-milestones-row-actions"

export type MilestoneRow = {
    id: string
    thresholdAmount: number
    thresholdCount: number
    bonusAmount: number
    sortOrder: number
    createdAt: string
}

export const invitationMilestonesColumns: ColumnDef<MilestoneRow>[] = [
    {
        accessorKey: "thresholdCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="达标人数" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium">{row.original.thresholdCount} 人</div>
        ),
    },
    {
        accessorKey: "thresholdAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="每人最低消费" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.original.thresholdAmount)}</div>
        ),
    },
    {
        accessorKey: "bonusAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="奖励金额" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium text-green-600">
                +{formatCurrency(row.original.bonusAmount)}
            </div>
        ),
    },
    {
        accessorKey: "createdAt",
        header: () => <div>起算日期</div>,
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
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
                thresholdCount={row.original.thresholdCount}
                bonusAmount={row.original.bonusAmount}
            />
        ),
    },
]
