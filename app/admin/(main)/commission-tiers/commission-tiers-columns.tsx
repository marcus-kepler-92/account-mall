"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"
import { CommissionTierRowActions } from "./commission-tier-row-actions"

export type TierRow = {
    id: string
    minAmount: number
    maxAmount: number
    ratePercent: number
    sortOrder: number
    createdAt: string
}

export const commissionTiersColumns: ColumnDef<TierRow>[] = [
    {
        accessorKey: "sortOrder",
        header: ({ column }) => <DataTableColumnHeader column={column} title="排序" />,
    },
    {
        accessorKey: "minAmount",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="销售额下限" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.original.minAmount)}</div>
        ),
    },
    {
        accessorKey: "maxAmount",
        header: () => <div className="text-right">当周销售额上限（元）</div>,
        cell: ({ row }) => (
            <div className="text-right">{formatCurrency(row.original.maxAmount)}</div>
        ),
    },
    {
        accessorKey: "ratePercent",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="佣金比例（%）" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right">{row.original.ratePercent}%</div>
        ),
    },
    {
        id: "actions",
        header: () => <div className="w-[80px]">操作</div>,
        cell: ({ row }) => (
            <CommissionTierRowActions
                id={row.original.id}
                minAmount={row.original.minAmount}
                maxAmount={row.original.maxAmount}
                ratePercent={row.original.ratePercent}
            />
        ),
    },
]
