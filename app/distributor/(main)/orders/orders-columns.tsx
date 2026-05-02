"use client"

import { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type DistributorOrderRow = {
    id: string
    orderNo: string
    productName: string
    quantity: number
    amount: number
    status: "PENDING" | "COMPLETED" | "CLOSED"
    commissionAmount: number | null
    createdAt: string
}

export function CommissionCell({ row }: { row: { original: Pick<DistributorOrderRow, "status" | "commissionAmount"> } }) {
    const { status, commissionAmount } = row.original
    if (status !== "COMPLETED") return <span className="text-muted-foreground text-sm">—</span>
    if (commissionAmount !== null) return <span className="text-sm font-medium">¥{commissionAmount.toFixed(2)}</span>
    return (
        <TooltipProvider delayDuration={0}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="secondary" className="text-xs cursor-help" aria-label="无奖金：下单邮箱与您的账号邮箱相同，此订单不计奖金">无奖金</Badge>
                </TooltipTrigger>
                <TooltipContent>下单邮箱与您的账号邮箱相同，此订单不计奖金</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
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
        id: "commissionAmount",
        header: "奖金",
        cell: ({ row }) => <CommissionCell row={row} />,
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
