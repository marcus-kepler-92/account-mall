"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type DistributorWithdrawalRow = {
    id: string
    amount: number
    status: "PENDING" | "PAID" | "REJECTED"
    createdAt: string
    processedAt: string | null
    note: string | null
}

const statusMap = {
    PENDING: { label: "待处理", variant: "warning" as const },
    PAID: { label: "已打款", variant: "success" as const },
    REJECTED: { label: "已拒绝", variant: "destructive" as const },
}

export const distributorWithdrawalsColumns: ColumnDef<DistributorWithdrawalRow>[] = [
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="金额" />
        ),
        cell: ({ row }) => (
            <span className="text-right font-medium">
                ¥{(row.getValue("amount") as number).toFixed(2)}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const status = row.getValue("status") as DistributorWithdrawalRow["status"]
            const { label, variant } = statusMap[status]
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, id, value) => {
            const val = row.getValue(id) as string
            return Array.isArray(value) ? value.includes(val) : value === val
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="申请时间" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {new Date(row.getValue("createdAt") as string).toLocaleString("zh-CN")}
            </span>
        ),
    },
    {
        accessorKey: "processedAt",
        header: "处理时间",
        cell: ({ row }) => {
            const processedAt = row.original.processedAt
            return (
                <span className="text-muted-foreground text-sm">
                    {processedAt
                        ? new Date(processedAt).toLocaleString("zh-CN")
                        : "—"}
                </span>
            )
        },
    },
    {
        accessorKey: "note",
        header: "备注",
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                {row.original.note || "—"}
            </span>
        ),
    },
]
