"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { DataTableColumnHeader } from "@/app/admin/components"

export type ChannelRow = {
    id: string
    nickname: string
    pid: string
    key: string
    submitUrl: string
    siteName: string
    type: string
    annualLimit: number
    sortOrder: number
    isActive: boolean
    createdAt: string
    yearIncome: number
    totalIncome: number
    totalWithdrawn: number
    balance: number
}

const TYPE_LABELS: Record<string, string> = {
    alipay: "支付宝",
    wxpay: "微信支付",
    qqpay: "QQ支付",
}

export const paymentChannelsColumns: ColumnDef<ChannelRow>[] = [
    {
        accessorKey: "nickname",
        header: ({ column }) => <DataTableColumnHeader column={column} title="渠道" />,
        cell: ({ row }) => (
            <div className="space-y-1">
                <Link
                    href={`/admin/payment-channels/${row.original.id}`}
                    className="font-medium hover:underline"
                >
                    {row.original.nickname}
                </Link>
                <div className="text-xs text-muted-foreground">{row.original.pid}</div>
            </div>
        ),
    },
    {
        accessorKey: "type",
        header: "类型",
        cell: ({ row }) => <Badge variant="outline">{TYPE_LABELS[row.original.type] ?? row.original.type}</Badge>,
    },
    {
        accessorKey: "yearIncome",
        header: ({ column }) => <DataTableColumnHeader column={column} title="年度进度" className="justify-end" />,
        cell: ({ row }) => {
            const { yearIncome, annualLimit } = row.original
            const pct = annualLimit > 0 ? Math.min(100, Math.round((yearIncome / annualLimit) * 100)) : 0
            const isWarning = pct >= 80
            return (
                <div className="space-y-1 min-w-32">
                    <div className="flex justify-between text-xs">
                        <span className={isWarning ? "text-warning font-medium" : "text-muted-foreground"}>
                            {formatCurrency(yearIncome)}
                        </span>
                        <span className="text-muted-foreground">/ {formatCurrency(annualLimit)}</span>
                    </div>
                    {/* Simple div-based progress bar (Progress component not available) */}
                    <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${isWarning ? "bg-warning" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: "balance",
        header: ({ column }) => <DataTableColumnHeader column={column} title="当前余额" className="justify-end" />,
        cell: ({ row }) => (
            <div className="space-y-0.5">
                <div className="font-medium">{formatCurrency(row.original.balance)}</div>
                <div className="text-xs text-muted-foreground">
                    累计收入 {formatCurrency(row.original.totalIncome)} · 已提现 {formatCurrency(row.original.totalWithdrawn)}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "isActive",
        header: "状态",
        cell: ({ row }) => (
            <Badge variant={row.original.isActive ? "default" : "secondary"}>
                {row.original.isActive ? "启用" : "停用"}
            </Badge>
        ),
    },
]
