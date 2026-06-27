"use client"

import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDateTime } from "@/lib/utils"

export type DistributorWithdrawalRow = {
    id: string
    amount: number
    feePercent: number
    feeAmount: number
    actualAmount: number
    status: "PENDING" | "PAID" | "REJECTED"
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
}

const statusMap: Record<
    DistributorWithdrawalRow["status"],
    { label: string; variant: "warning" | "success" | "destructive" }
> = {
    PENDING: { label: "待处理", variant: "warning" },
    PAID: { label: "已打款", variant: "success" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
}

export const distributorWithdrawalsColumns: ColumnDef<DistributorWithdrawalRow>[] = [
    {
        accessorKey: "amount",
        header: "申请金额",
        cell: ({ row }) => (
            <span className="tabular-nums">{formatCurrency(row.original.amount)}</span>
        ),
    },
    {
        id: "actual",
        header: "实付",
        cell: ({ row }) => {
            const { actualAmount, feeAmount, feePercent } = row.original
            return (
                <div className="flex flex-col">
                    <span className="tabular-nums">{formatCurrency(actualAmount)}</span>
                    {feeAmount > 0 && (
                        <span className="text-xs text-muted-foreground">
                            手续费 {feePercent}% · {formatCurrency(feeAmount)}
                        </span>
                    )}
                </div>
            )
        },
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
        },
    },
    {
        id: "receipt",
        header: "收款码",
        cell: ({ row }) =>
            row.original.receiptImageUrl ? (
                <Link
                    href={row.original.receiptImageUrl}
                    target="_blank"
                    className="text-xs text-primary hover:underline"
                >
                    查看
                </Link>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "note",
        header: "备注",
        cell: ({ row }) => (
            <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                {row.original.note ?? "—"}
            </span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: "申请时间",
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">
                {formatDateTime(row.original.createdAt)}
            </span>
        ),
    },
    {
        id: "processedAt",
        header: "处理时间",
        cell: ({ row }) => (
            <span className="text-xs text-muted-foreground">
                {row.original.processedAt ? formatDateTime(row.original.processedAt) : "—"}
            </span>
        ),
    },
]
