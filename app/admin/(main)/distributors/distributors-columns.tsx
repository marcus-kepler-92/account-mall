"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { DistributorRowActions, BalanceTooltip, CommissionTooltip } from "./distributor-row-actions"

export type DistributorRow = {
    id: string
    email: string
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    totalCommission: number
    level1CommissionTotal: number
    level2CommissionTotal: number
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    withdrawableBalance: number
    inviteeCount: number
    inviter: { id: string; name: string; distributorCode: string | null } | null
}

export const distributorsColumns: ColumnDef<DistributorRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="昵称" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
        ),
    },
    {
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {row.original.email}
            </span>
        ),
    },
    {
        accessorKey: "distributorCode",
        header: "推荐码",
        cell: ({ row }) =>
            row.original.distributorCode ? (
                <code className="text-xs font-mono">{row.original.distributorCode}</code>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "inviter",
        header: "上线",
        cell: ({ row }) => {
            const inv = row.original.inviter
            if (!inv) return <span className="text-muted-foreground">—</span>
            return (
                <span className="text-sm">
                    {inv.name}
                    {inv.distributorCode && (
                        <span className="text-muted-foreground font-mono ml-1 text-xs">
                            {inv.distributorCode}
                        </span>
                    )}
                </span>
            )
        },
    },
    {
        accessorKey: "inviteeCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="下线数" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right text-muted-foreground">
                {row.original.inviteeCount}
            </div>
        ),
    },
    {
        accessorKey: "discountCodeEnabled",
        header: "优惠码",
        cell: ({ row }) =>
            row.original.discountCodeEnabled ? (
                <Badge variant="secondary">已启用</Badge>
            ) : (
                <span className="text-muted-foreground text-sm">关闭</span>
            ),
    },
    {
        accessorKey: "discountPercent",
        header: "折扣比例",
        cell: ({ row }) =>
            row.original.discountPercent != null ? (
                <span className="tabular-nums">{row.original.discountPercent}%</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "disabledAt",
        header: "状态",
        cell: ({ row }) => {
            const disabled = !!row.original.disabledAt
            return (
                <Badge variant={disabled ? "destructive" : "default"}>
                    {disabled ? "已停用" : "启用"}
                </Badge>
            )
        },
    },
    {
        accessorKey: "completedOrderCount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="成交订单" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right">{row.original.completedOrderCount}</div>
        ),
    },
    {
        accessorKey: "totalCommission",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="累计佣金" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <CommissionTooltip row={row.original} />
            </div>
        ),
    },
    {
        accessorKey: "withdrawableBalance",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="可提现余额" className="justify-end" />
        ),
        enableSorting: false,
        cell: ({ row }) => (
            <div className="text-right font-medium">
                <BalanceTooltip row={row.original} />
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <DistributorRowActions row={row.original} />,
        enableSorting: false,
        enableHiding: false,
    },
]
