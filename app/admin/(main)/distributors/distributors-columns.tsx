"use client"

declare module "@tanstack/react-table" {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData, TValue> {
        className?: string
    }
}

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { DistributorRowActions, BalanceTooltip, CommissionTooltip } from "./distributor-row-actions"

export type DistributorRow = {
    id: string
    email: string | null
    username: string | null
    name: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    disabledAt: string | null
    createdAt: string
    completedOrderCount: number
    salesTotal: number
    weeklySalesTotal: number
    totalCommission: number
    level1CommissionTotal: number
    level2CommissionTotal: number
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    withdrawableBalance: number
    inviteeCount: number
    invitees: { id: string; name: string; distributorCode: string | null }[]
    inviter: { id: string; name: string; distributorCode: string | null } | null
    milestoneSummary: {
        triggeredCount: number
        nextMilestone: { thresholdAmount: number; thresholdCount: number; bonusAmount: number } | null
    } | null
}

export function DistributorIdentityCell({ row }: { row: DistributorRow }) {
    const disabled = !!row.disabledAt
    return (
        <div className="space-y-0.5">
            <div className="flex items-center gap-2">
                <span className="font-medium">{row.name}</span>
                <Badge variant={disabled ? "destructive" : "default"} className="text-xs">
                    {disabled ? "已停用" : "启用"}
                </Badge>
            </div>
            <div className="text-xs text-muted-foreground">{row.email ?? row.username ?? "—"}</div>
            {row.distributorCode && (
                <code className="text-xs font-mono text-muted-foreground">{row.distributorCode}</code>
            )}
        </div>
    )
}

export function DistributorTeamCell({ row }: { row: DistributorRow }) {
    return (
        <div className="space-y-0.5">
            {row.inviter && (
                <div className="text-sm">{row.inviter.name}</div>
            )}
            {row.inviteeCount > 0 && (
                <Badge variant="secondary" className="text-xs font-normal">
                    下线 {row.inviteeCount}
                </Badge>
            )}
            {!row.inviter && row.inviteeCount === 0 && (
                <span className="text-muted-foreground">—</span>
            )}
        </div>
    )
}

export function DistributorSalesCell({ row }: { row: DistributorRow }) {
    return (
        <div className="text-right space-y-0.5">
            <div className="font-medium tabular-nums">¥{row.salesTotal.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">{row.completedOrderCount} 单</div>
        </div>
    )
}

export function DistributorDiscountCell({ row }: { row: DistributorRow }) {
    if (!row.discountCodeEnabled) {
        return <span className="text-sm text-muted-foreground">关闭</span>
    }
    const label = row.discountPercent != null ? `已启用 · ${row.discountPercent}%` : "已启用"
    return <Badge variant="secondary">{label}</Badge>
}

export const distributorsColumns: ColumnDef<DistributorRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="分销员" />
        ),
        cell: ({ row }) => <DistributorIdentityCell row={row.original} />,
    },
    {
        accessorKey: "inviter",
        header: "团队",
        enableSorting: false,
        cell: ({ row }) => <DistributorTeamCell row={row.original} />,
        meta: { className: "hidden sm:table-cell" },
    },
    {
        accessorKey: "salesTotal",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="销售额" className="justify-end" />
        ),
        cell: ({ row }) => <DistributorSalesCell row={row.original} />,
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
        meta: { className: "hidden sm:table-cell" },
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
        meta: { className: "hidden lg:table-cell" },
    },
    {
        accessorKey: "discountCodeEnabled",
        header: "优惠码",
        enableSorting: false,
        cell: ({ row }) => <DistributorDiscountCell row={row.original} />,
        meta: { className: "hidden lg:table-cell" },
    },
    {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
            <div onClick={(e) => e.stopPropagation()}>
                <DistributorRowActions row={row.original} />
            </div>
        ),
        enableSorting: false,
        enableHiding: false,
    },
]
