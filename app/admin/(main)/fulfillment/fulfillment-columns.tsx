"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Bell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { FulfillmentRowActions } from "./fulfillment-row-actions"

export type FulfillmentRow = {
    id: string
    orderNo: string
    email: string
    productName: string
    variantName: string | null
    quantity: number
    amount: number
    status:
        | "AWAITING_FULFILLMENT"
        | "PROCESSING"
        | "COMPLETED"
        | "CLOSED"
    dunCount: number
    lastDunAt: string | null
    createdAt: string
}

const statusMap: Record<
    FulfillmentRow["status"],
    { label: string; variant: "warning" | "success" | "secondary" }
> = {
    AWAITING_FULFILLMENT: { label: "待接单", variant: "warning" },
    PROCESSING: { label: "处理中", variant: "warning" },
    COMPLETED: { label: "已完成", variant: "success" },
    CLOSED: { label: "已关闭", variant: "secondary" },
}

function formatWaitingDuration(iso: string): string {
    const start = new Date(iso).getTime()
    if (Number.isNaN(start)) return "—"
    const diffMs = Date.now() - start
    if (diffMs <= 0) return "刚刚"
    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 60) return `${minutes} 分钟`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} 小时`
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return remHours > 0 ? `${days} 天 ${remHours} 小时` : `${days} 天`
}

export const fulfillmentColumns: ColumnDef<FulfillmentRow>[] = [
    {
        accessorKey: "orderNo",
        header: "订单号",
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
        id: "product",
        header: "商品 / SKU",
        cell: ({ row }) => (
            <div className="flex flex-col">
                <span className="font-medium">{row.original.productName}</span>
                {row.original.variantName && (
                    <span className="text-xs text-muted-foreground">
                        {row.original.variantName}
                    </span>
                )}
            </div>
        ),
    },
    {
        accessorKey: "email",
        header: "买家",
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">{row.original.email}</span>
        ),
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">金额</div>,
        cell: ({ row }) => (
            <div className="text-right font-medium">
                {formatCurrency(row.original.amount)}
            </div>
        ),
    },
    {
        id: "waiting",
        header: "等待时长",
        cell: ({ row }) => (
            <div className="flex flex-col text-sm">
                <span>{formatWaitingDuration(row.original.createdAt)}</span>
                <span className="text-xs text-muted-foreground">
                    {formatDateTime(row.original.createdAt)}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "dunCount",
        header: () => <div className="text-right">催</div>,
        cell: ({ row }) =>
            row.original.dunCount > 0 ? (
                <div className="flex items-center justify-end gap-1 text-destructive">
                    <Bell className="size-3.5" />
                    {row.original.dunCount}
                </div>
            ) : (
                <div className="text-right text-muted-foreground">—</div>
            ),
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const badge = statusMap[row.original.status]
            return <Badge variant={badge.variant}>{badge.label}</Badge>
        },
    },
    {
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
            <div className="flex justify-end">
                <FulfillmentRowActions order={row.original} />
            </div>
        ),
    },
]
