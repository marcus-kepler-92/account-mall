"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { CardRowActions } from "./card-row-actions"
import type { ResolvedCard } from "@/lib/card-format"

export type CardRow = {
    id: string
    content: string
    resolved: ResolvedCard
    status: "UNSOLD" | "RESERVED" | "SOLD" | "DISABLED"
    orderNo: string | null
    product: {
        id: string
        name: string
        slug: string
        isFree: boolean
    }
    createdAt: string
}

const statusMap = {
    UNSOLD: { label: "未售", className: "border-success/50 bg-success/10 text-success" },
    RESERVED: { label: "预占中", className: "border-warning/50 bg-warning/10 text-warning" },
    SOLD: { label: "已售", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
    DISABLED: { label: "停用", className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground" },
}

export const cardsColumns: ColumnDef<CardRow>[] = [
    {
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="全选"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="选择行"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "content",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="卡密" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.getValue("content")}</span>
        ),
    },
    {
        accessorKey: "product",
        header: "商品",
        cell: ({ row }) => {
            const product = row.original.product
            return (
                <div className="flex flex-col">
                    {product.isFree ? (
                        <span className="text-sm font-medium">{product.name}</span>
                    ) : (
                        <Link
                            href={`/admin/products/${product.id}/cards`}
                            className="text-sm font-medium hover:underline"
                        >
                            {product.name}
                        </Link>
                    )}
                    <span className="text-xs text-muted-foreground">/{product.slug}</span>
                </div>
            )
        },
        enableSorting: false,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const status = row.getValue("status") as CardRow["status"]
            const { label, className } = statusMap[status]
            return (
                <Badge variant="outline" className={className}>
                    {label}
                </Badge>
            )
        },
        filterFn: (row, id, value) => {
            return value.includes(row.getValue(id))
        },
    },
    {
        accessorKey: "orderNo",
        header: "订单号",
        cell: ({ row }) => {
            const orderNo = row.getValue("orderNo") as string | null
            return (
                <span className="text-xs text-muted-foreground font-mono">
                    {orderNo ?? "—"}
                </span>
            )
        },
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="创建时间" />
        ),
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">
                {formatDateTime(row.getValue("createdAt") as string)}
            </span>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => (
            <div onClick={(e) => e.stopPropagation()}>
                <CardRowActions card={row.original} />
            </div>
        ),
    },
]
