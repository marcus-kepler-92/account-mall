"use client"

import { formatDateTime, formatCurrency } from "@/lib/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ReceiptCell } from "./receipt-cell"
import { BalanceCell } from "./balance-cell"

export type WithdrawalRow = {
    id: string
    distributorId: string
    distributor: { id: string; email: string | null; username: string | null; name: string }
    amount: number
    feePercent: number
    feeAmount: number
    actualAmount: number
    status: "PENDING" | "PAID" | "REJECTED"
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    currentBalance: number
}

const statusMap: Record<
    WithdrawalRow["status"],
    { label: string; variant: "warning" | "success" | "destructive" }
> = {
    PENDING: { label: "待处理", variant: "warning" },
    PAID: { label: "已打款", variant: "success" },
    REJECTED: { label: "已拒绝", variant: "destructive" },
}

export const withdrawalsColumns: ColumnDef<WithdrawalRow>[] = [
        {
            id: "distributor",
            accessorFn: (row) => row.distributor.name,
            header: "分销员",
            cell: ({ row }) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.distributor.name}</span>
                    <span className="text-xs text-muted-foreground">
                        {row.original.distributor.email ?? row.original.distributor.username ?? "—"}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="申请金额" className="justify-end" />
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium">{formatCurrency(row.original.amount)}</div>
            ),
        },
        {
            id: "actualAmount",
            header: () => (
                <div className="text-right">
                    <span className="hidden md:inline">实付金额</span>
                    <span className="md:hidden">打款金额</span>
                </div>
            ),
            cell: ({ row }) => {
                const { feeAmount, actualAmount, feePercent } = row.original
                return (
                    <div className="text-right">
                        <span className="font-medium">{formatCurrency(actualAmount)}</span>
                        {feeAmount > 0 && (
                            <span className="block text-xs text-muted-foreground">
                                手续费 {feePercent}% = -¥{feeAmount.toFixed(2)}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            id: "currentBalance",
            header: () => <div className="text-right">可提现余额</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <BalanceCell row={row.original} />
                </div>
            ),
        },
        {
            id: "receipt",
            header: "收款码",
            cell: ({ row }) => (
                <ReceiptCell
                    url={row.original.receiptImageUrl}
                    distributorName={row.original.distributor.name}
                    actualAmount={row.original.actualAmount}
                    amount={row.original.amount}
                    feeAmount={row.original.feeAmount}
                    feePercent={row.original.feePercent}
                />
            ),
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
            accessorKey: "createdAt",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="申请时间" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">
                    {formatDateTime(row.original.createdAt)}
                </span>
            ),
        },
        {
            accessorKey: "note",
            header: "备注",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
                    {row.original.note || "—"}
                </span>
            ),
        },
]
