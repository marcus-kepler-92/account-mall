"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatDateTime, formatCurrency } from "@/lib/utils"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { OrderRowActions } from "./order-row-actions"
import { OrderDistributorCell, type DistributorOption } from "./order-distributor-cell"

export type OrderRow = {
    id: string
    orderNo: string
    email: string
    distributorId: string | null
    distributor: { id: string; name: string; distributorCode: string | null } | null
    product: {
        id: string
        name: string
        price: number
    }
    quantity: number
    amount: number
    status: "PENDING" | "COMPLETED" | "CLOSED"
    paymentMethod: string | null
    paidAt: string | null
    createdAt: string
    cardsCount: number
    reservedCardsCount: number
    soldCardsCount: number
}

const statusMap = {
    PENDING: { label: "待完成", variant: "warning" as const },
    COMPLETED: { label: "已完成", variant: "success" as const },
    CLOSED: { label: "已关闭", variant: "secondary" as const },
}

const paymentMethodLabel: Record<string, string> = {
    wxpay: "微信",
    qqpay: "QQ钱包",
}

export function createOrdersColumns(distributors: DistributorOption[]): ColumnDef<OrderRow>[] {
  return [
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
        accessorKey: "orderNo",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="订单号" />
        ),
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
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
                {row.getValue("email") as string}
            </span>
        ),
    },
    {
        accessorKey: "distributor",
        header: "分销员",
        cell: ({ row }) => (
            <OrderDistributorCell
                orderId={row.original.id}
                distributor={row.original.distributor}
                distributors={distributors}
            />
        ),
        enableSorting: false,
    },
    {
        accessorKey: "product",
        header: "商品",
        cell: ({ row }) => {
            const product = row.original.product
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {formatCurrency(product.price)}
                    </span>
                </div>
            )
        },
        enableSorting: false,
    },
    {
        accessorKey: "quantity",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="数量" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <span className="text-right">{row.getValue("quantity") as number}</span>
        ),
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="金额" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <span className="text-right font-medium">
                {formatCurrency(row.getValue("amount") as number)}
            </span>
        ),
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const status = row.getValue("status") as OrderRow["status"]
            const { label, variant } = statusMap[status]
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, id, value) => {
            const val = row.getValue(id) as string
            return value.includes(val)
        },
    },
    {
        id: "cards",
        header: "卡密",
        cell: ({ row }) => {
            const o = row.original
            return (
                <span className="text-xs text-muted-foreground">
                    {o.soldCardsCount}/{o.cardsCount} 已售
                </span>
            )
        },
        enableSorting: false,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="创建时间" />
        ),
        enableSorting: false,
        cell: ({ row }) => {
            const createdAt = row.getValue("createdAt") as string
            const paidAt = row.original.paidAt
            const paymentMethod = row.original.paymentMethod
            const pmLabel = paymentMethod ? (paymentMethodLabel[paymentMethod] ?? "支付宝") : "支付宝"
            return (
                <div className="flex flex-col items-end text-xs">
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{pmLabel}</span>
                        <span>{formatDateTime(createdAt)}</span>
                    </div>
                    {paidAt && (
                        <span className="text-muted-foreground">
                            支付于 {formatDateTime(paidAt)}
                        </span>
                    )}
                </div>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <OrderRowActions order={row.original} />,
    },
  ]
}
