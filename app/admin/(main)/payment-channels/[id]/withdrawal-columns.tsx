"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { WithdrawalRowActions } from "./withdrawal-row-actions"

export type WithdrawalRow = {
    id: string
    channelId: string
    amount: number
    note: string
    createdAt: string
}

export const withdrawalColumns: ColumnDef<WithdrawalRow>[] = [
    {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="金额" className="justify-end" />,
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
    },
    {
        accessorKey: "note",
        header: "备注",
        cell: ({ row }) => (
            <span className="text-muted-foreground">{row.original.note || "—"}</span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="记录时间" />,
        cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
        id: "actions",
        cell: ({ row }) => <WithdrawalRowActions row={row.original} />,
    },
]
