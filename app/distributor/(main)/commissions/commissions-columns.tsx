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

export type DistributorCommissionRow =
    | {
          kind: "commission"
          id: string
          orderNo: string
          amount: number
          status: "PENDING" | "SETTLED" | "WITHDRAWN" | "CANCELLED"
          level: 1 | 2
          sourceDistributorName?: string
          createdAt: string
      }
    | {
          kind: "milestone"
          id: string
          amount: number
          countSnapshot: number
          thresholdSnapshot: number
          createdAt: string
      }

const statusMap = {
    PENDING: { label: "待结算", variant: "warning" as const },
    SETTLED: { label: "已结算", variant: "success" as const },
    WITHDRAWN: { label: "已提现", variant: "secondary" as const },
    CANCELLED: { label: "已取消", variant: "destructive" as const },
}

export const distributorCommissionsColumns: ColumnDef<DistributorCommissionRow>[] = [
    {
        id: "type",
        header: "类型",
        cell: ({ row }) => {
            const r = row.original
            if (r.kind === "milestone") {
                return <Badge variant="outline" className="text-violet-600 border-violet-300">邀请奖励</Badge>
            }
            if (r.level === 2) {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="cursor-default">团队推广</Badge>
                            </TooltipTrigger>
                            {r.sourceDistributorName && (
                                <TooltipContent><p>来自：{r.sourceDistributorName}</p></TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                )
            }
            return <Badge variant="default">直接推广</Badge>
        },
    },
    {
        id: "description",
        header: "说明",
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => {
            const r = row.original
            if (r.kind === "milestone") {
                return (
                    <span className="text-sm text-muted-foreground">
                        {r.countSnapshot} 人各达标 ¥{r.thresholdSnapshot.toFixed(0)}
                    </span>
                )
            }
            return <span className="font-mono text-xs">{r.orderNo}</span>
        },
    },
    {
        id: "amount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="金额" />
        ),
        accessorFn: (row) => row.amount,
        cell: ({ row }) => (
            <span className="font-medium">¥{row.original.amount.toFixed(2)}</span>
        ),
    },
    {
        id: "status",
        header: "状态",
        cell: ({ row }) => {
            const r = row.original
            if (r.kind === "milestone") return <Badge variant="secondary">已发放</Badge>
            const { label, variant } = statusMap[r.status]
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, _, value) => {
            const r = row.original
            if (r.kind === "milestone") return true
            return Array.isArray(value) ? value.includes(r.status) : value === r.status
        },
    },
    {
        id: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="时间" />
        ),
        accessorFn: (row) => row.createdAt,
        meta: { className: "hidden sm:table-cell" },
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.createdAt)}
            </span>
        ),
    },
]
