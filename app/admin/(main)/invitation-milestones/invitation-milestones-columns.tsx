"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { InvitationMilestoneRowActions } from "./invitation-milestones-row-actions"

export type MilestoneRow = {
    id: string
    type: "INVITATION" | "SALES"
    thresholdAmount: number
    thresholdCount: number
    bonusAmount: number
    sortOrder: number
    createdAt: string
}

export const invitationMilestonesColumns: ColumnDef<MilestoneRow>[] = [
    {
        accessorKey: "type",
        header: () => <div>类型</div>,
        cell: ({ row }) => (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                row.original.type === "INVITATION"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-purple-50 text-purple-700"
            }`}>
                {row.original.type === "INVITATION" ? "邀请" : "销售"}
            </span>
        ),
    },
    {
        accessorKey: "thresholdAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="个人销售门槛" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.original.thresholdAmount)}</div>
        ),
    },
    {
        accessorKey: "thresholdCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="达标人数" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{row.original.thresholdCount} 人</div>
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
        header: () => <div>起算日期</div>,
        meta: { className: "hidden sm:table-cell" },
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
                type={row.original.type}
                thresholdAmount={row.original.thresholdAmount}
                thresholdCount={row.original.thresholdCount}
                bonusAmount={row.original.bonusAmount}
            />
        ),
    },
]
