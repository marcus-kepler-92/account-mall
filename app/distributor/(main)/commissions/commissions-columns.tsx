"use client"

import { ColumnDef } from "@tanstack/react-table"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type DistributorCommissionRow = {
    id: string
    orderNo: string
    amount: number
    status: "PENDING" | "SETTLED" | "WITHDRAWN"
    level: 1 | 2
    sourceDistributorName?: string
    createdAt: string
}

const statusMap = {
    PENDING: { label: "待结算", variant: "warning" as const },
    SETTLED: { label: "已结算", variant: "success" as const },
    WITHDRAWN: { label: "已提现", variant: "secondary" as const },
}

export const distributorCommissionsColumns: ColumnDef<DistributorCommissionRow>[] = [
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
        accessorKey: "level",
        header: "类型",
        cell: ({ row }) => {
            const level = row.original.level
            if (level === 2) {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-default">二级推广</Badge>
                            </TooltipTrigger>
                            {row.original.sourceDistributorName && (
                                <TooltipContent>
                                    <p>来自下线：{row.original.sourceDistributorName}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                )
            }
            return <Badge variant="default">一级推广</Badge>
        },
    },
    {
        accessorKey: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="佣金金额" />
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
            const status = row.getValue("status") as DistributorCommissionRow["status"]
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
