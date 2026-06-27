"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatCurrency, formatDateTime } from "@/lib/utils"

export type DistributorCommissionRow = {
    id: string
    orderId: string
    orderNo: string
    amount: number
    status: "PENDING" | "SETTLED" | "WITHDRAWN" | "CANCELLED"
    level: number
    sourceName: string | null
    createdAt: string
}

const statusMap: Record<
    DistributorCommissionRow["status"],
    { label: string; variant: "warning" | "success" | "secondary" | "destructive" }
> = {
    PENDING: { label: "待结算", variant: "warning" },
    SETTLED: { label: "已结算", variant: "success" },
    WITHDRAWN: { label: "已提现", variant: "secondary" },
    CANCELLED: { label: "已取消", variant: "destructive" },
}

// CANCELLED is hidden from the filter UI (default view excludes it).
export const commissionStatusOptions = Object.entries(statusMap)
    .filter(([value]) => value !== "CANCELLED")
    .map(([value, { label }]) => ({ label, value }))

export const distributorCommissionsColumns: ColumnDef<DistributorCommissionRow>[] = [
    {
        id: "level",
        header: "类型",
        enableSorting: false,
        cell: ({ row }) => {
            const { level, sourceName } = row.original
            return level === 2 ? (
                <div className="flex flex-col gap-0.5">
                    <Badge variant="outline" className="w-fit">
                        团队推广
                    </Badge>
                    {sourceName && (
                        <span className="text-xs text-muted-foreground">来自 {sourceName}</span>
                    )}
                </div>
            ) : (
                <Badge variant="outline" className="w-fit">
                    直接推广
                </Badge>
            )
        },
    },
    {
        accessorKey: "orderNo",
        header: "订单号",
        enableSorting: false,
        cell: ({ row }) => (
            <Link
                href={`/admin/orders/${row.original.orderId}`}
                className="font-mono text-xs hover:underline"
            >
                {row.original.orderNo}
            </Link>
        ),
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="佣金" />
        ),
        cell: ({ row }) => (
            <span className="tabular-nums text-amber-600">
                {formatCurrency(row.original.amount)}
            </span>
        ),
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
