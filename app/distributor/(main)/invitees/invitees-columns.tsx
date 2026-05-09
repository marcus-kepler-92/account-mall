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
        header: "个人达标",
        cell: ({ row }) => {
            const { nextMilestone } = row.original
            if (!nextMilestone) return null
            const qualified = nextMilestone.cumulative >= nextMilestone.thresholdAmount
            if (qualified) {
                return <span className="text-xs font-medium text-green-600">已达标 ✓</span>
            }
            return (
                <div className="space-y-0.5 min-w-[140px]">
                    <p className="text-xs text-muted-foreground">
                        还差 ¥{(nextMilestone.thresholdAmount - nextMilestone.cumulative).toFixed(2)}
                    </p>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden w-28">
                        <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{
                                width: `${Math.min(100, (nextMilestone.cumulative / nextMilestone.thresholdAmount) * 100).toFixed(1)}%`,
                            }}
                        />
                    </div>
                </div>
            )
        },
    },
]
