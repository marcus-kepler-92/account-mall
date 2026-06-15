"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { PayoutRowActions } from "./payout-row-actions"

export type PayoutRow = {
    id: string
    amount: number
    note: string
    createdAt: string
}

export const payoutColumns: ColumnDef<PayoutRow>[] = [
    {
        accessorKey: "amount",
        header: ({ column }) => <DataTableColumnHeader column={column} title="金额" className="justify-end" />,
        cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.amount)}</span>,
    },
    {
        accessorKey: "note",
        header: "备注",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.note || "—"}</span>,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="记录时间" />,
        cell: ({ row }) => <span className="text-sm">{formatDateTime(row.original.createdAt)}</span>,
    },
    {
        id: "actions",
        cell: ({ row }) => <PayoutRowActions row={row.original} />,
    },
]
