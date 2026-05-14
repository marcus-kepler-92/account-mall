"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type InviteeRow = {
    id: string
    name: string
    email: string | null
    username: string | null
    createdAt: string
    level2CommissionTotal: number
    weeklySalesTotal: number
    salesTotal: number
    completedOrderCount: number
    tierLabel: string | null
    nextTierMinAmount: number | null
}

export const inviteesColumns: ColumnDef<InviteeRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="成员" />
        ),
        cell: ({ row }) => {
            const { name, email, username, weeklySalesTotal } = row.original
            const active = weeklySalesTotal > 0
            const initial = name.charAt(0).toUpperCase()
            const contact = email ?? username ?? "—"
            return (
                <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold select-none">
                            {initial}
                        </div>
                        <span className={cn(
                            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background",
                            active ? "bg-green-500" : "bg-muted-foreground/30"
                        )} />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium leading-tight truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">{contact}</p>
                    </div>
                </div>
            )
        },
    },
    {
        id: "tier",
        header: "档位",
        cell: ({ row }) => (
            row.original.tierLabel
                ? <Badge variant="secondary" className="font-normal whitespace-nowrap">{row.original.tierLabel}</Badge>
                : <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
        id: "weeklyProgress",
        header: "本周销售",
        cell: ({ row }) => {
            const { weeklySalesTotal, nextTierMinAmount } = row.original
            return (
                <div className="space-y-0.5 min-w-[100px]">
                    <p className="font-semibold tabular-nums">¥{weeklySalesTotal.toFixed(2)}</p>
                    {nextTierMinAmount !== null && weeklySalesTotal < nextTierMinAmount && (
                        <p className="text-xs text-muted-foreground">
                            差¥{(nextTierMinAmount - weeklySalesTotal).toFixed(2)} 升档
                        </p>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: "level2CommissionTotal",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="为我创造奖金" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">
                <p className="font-semibold tabular-nums">¥{row.original.level2CommissionTotal.toFixed(2)}</p>
            </div>
        ),
    },
]
