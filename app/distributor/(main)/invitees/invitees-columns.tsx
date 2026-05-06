"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type InviteeRow = {
    id: string
    name: string
    email: string | null
    username: string | null
    createdAt: string
    level2CommissionTotal: number
    nextMilestone: { thresholdAmount: number; bonusAmount: number; cumulative: number } | null
    triggeredMilestoneCount: number
}

export const inviteesColumns: ColumnDef<InviteeRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="昵称" />
        ),
        cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
        ),
    },
    {
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {row.original.email ?? row.original.username ?? "—"}
            </span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="加入时间" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {new Date(row.original.createdAt).toLocaleDateString("zh-CN")}
            </span>
        ),
    },
    {
        accessorKey: "level2CommissionTotal",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="为我创造团队奖金" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium">
                ¥{row.original.level2CommissionTotal.toFixed(2)}
            </div>
        ),
    },
    {
        id: "milestoneProgress",
        header: "里程碑进度",
        cell: ({ row }) => {
            const { nextMilestone, triggeredMilestoneCount } = row.original
            if (!nextMilestone && triggeredMilestoneCount === 0) return null
            return (
                <div className="space-y-1 min-w-[160px]">
                    {triggeredMilestoneCount > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                            已达成 {triggeredMilestoneCount} 个里程碑
                        </p>
                    )}
                    {nextMilestone && (
                        <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">
                                距下一档（¥{nextMilestone.thresholdAmount.toFixed(0)}）还差
                                ¥{Math.max(0, nextMilestone.thresholdAmount - nextMilestone.cumulative).toFixed(2)}
                            </p>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden w-32">
                                <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{
                                        width: `${Math.min(100, (nextMilestone.cumulative / nextMilestone.thresholdAmount) * 100).toFixed(1)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )
        },
    },
]
