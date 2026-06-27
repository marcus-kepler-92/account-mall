"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatCurrency, formatDateTime } from "@/lib/utils"

export type DistributorOrderRow = {
    id: string
    orderNo: string
    productName: string
    amount: number
    commissionAmount: number
    status:
        | "PENDING"
        | "AWAITING_FULFILLMENT"
        | "PROCESSING"
        | "COMPLETED"
        | "CLOSED"
        | "REFUNDED"
    createdAt: string
}

const statusMap: Record<
    DistributorOrderRow["status"],
    { label: string; variant: "warning" | "success" | "secondary" | "destructive" }
> = {
    PENDING: { label: "待完成", variant: "warning" },
    AWAITING_FULFILLMENT: { label: "待发货", variant: "warning" },
    PROCESSING: { label: "发货中", variant: "warning" },
    COMPLETED: { label: "已完成", variant: "success" },
    CLOSED: { label: "已关闭", variant: "secondary" },
    REFUNDED: { label: "已退款", variant: "destructive" },
}

export const orderStatusOptions = Object.entries(statusMap).map(([value, { label }]) => ({
    label,
    value,
}))

export const distributorOrdersColumns: ColumnDef<DistributorOrderRow>[] = [
    {
        accessorKey: "orderNo",
        header: "订单号",
        enableSorting: false,
        cell: ({ row }) => (
            <Link
                href={`/admin/orders/${row.original.id}`}
                className="font-mono text-xs hover:underline"
            >
                {row.original.orderNo}
            </Link>
        ),
    },
    {
        accessorKey: "productName",
        header: "商品",
        enableSorting: false,
        cell: ({ row }) => (
            <span className="font-medium">{row.original.productName}</span>
        ),
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="金额" />
        ),
        cell: ({ row }) => (
            <span className="tabular-nums">{formatCurrency(row.original.amount)}</span>
        ),
    },
    {
        accessorKey: "commissionAmount",
        header: "本单佣金",
        enableSorting: false,
        cell: ({ row }) => {
            const c = row.original.commissionAmount
            return c > 0 ? (
                <span className="tabular-nums text-amber-600">{formatCurrency(c)}</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            )
        },
    },
    {
        accessorKey: "status",
        header: "状态",
        enableSorting: false,
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="时间" />
        ),
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">
                {formatDateTime(row.original.createdAt)}
            </span>
        ),
    },
]
