"use client"

import { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type DistributorOrderRow = {
    id: string
    orderNo: string
    productName: string
    quantity: number
    amount: number
    status: "PENDING" | "COMPLETED" | "CLOSED"
    createdAt: string
}

const statusMap = {
    PENDING: { label: "待支付", variant: "warning" as const },
    COMPLETED: { label: "已完成", variant: "success" as const },
    CLOSED: { label: "已关闭", variant: "secondary" as const },
}

export const distributorOrdersColumns: ColumnDef<DistributorOrderRow>[] = [
    {
        accessorKey: "orderNo",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="订单号" />
        ),
        cell: ({ row }) => (
            <span className="font-mono text-xs">
                {row.original.orderNo}
            </span>
        ),
    },
    {
        accessorKey: "productName",
        header: "商品",
        cell: ({ row }) => (
            <span className="text-sm">{row.getValue("productName") as string}</span>
        ),
    },
    {
        accessorKey: "quantity",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="数量" />
        ),
        cell: ({ row }) => (
            <span className="text-right">{row.getValue("quantity") as number}</span>
        ),
    },
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
            const status = row.getValue("status") as DistributorOrderRow["status"]
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
            <DataTableColumnHeader column={column} title="时间" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.getValue("createdAt") as string)}
            </span>
        ),
    },
]
