"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { DataTableColumnHeader } from "@/app/admin/components"
import { WithdrawalRowActions } from "./withdrawal-row-actions"

export type WithdrawalRow = {
    id: string
    distributorId: string
    distributor: { id: string; email: string; name: string }
    amount: number
    feePercent: number
    feeAmount: number
    actualAmount: number
    status: string
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
    // Balance fields
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    currentBalance: number
}

const statusMap: Record<string, { label: string; variant: "warning" | "success" | "destructive" }> =
    {
        PENDING: { label: "待处理", variant: "warning" },
        PAID: { label: "已打款", variant: "success" },
        REJECTED: { label: "已拒绝", variant: "destructive" },
    }

function ReceiptCell({ url }: { url: string | null }) {
    const [open, setOpen] = useState(false)
    if (!url) return <span className="text-muted-foreground text-sm">—</span>
    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary hover:underline"
                onClick={() => setOpen(true)}
            >
                查看
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[90vw] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>收款码</DialogTitle>
                        <DialogDescription>分销员上传的收款码，打款时请核对</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                        <img
                            src={url}
                            alt="收款码"
                            className="max-h-[60vh] max-w-full object-contain"
                        />
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setOpen(false)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function BalanceCell({ row }: { row: WithdrawalRow }) {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-default tabular-nums underline decoration-dashed underline-offset-2">
                        ¥{row.currentBalance.toFixed(2)}
                    </span>
                </TooltipTrigger>
                <TooltipContent className="w-56 text-xs space-y-1 p-3">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">一级佣金（已结算）</span>
                        <span>¥{row.level1Settled.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">二级佣金（已结算）</span>
                        <span>¥{row.level2Settled.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between">
                        <span className="text-muted-foreground">已打款</span>
                        <span>-¥{row.paidTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">提现中</span>
                        <span>-¥{row.pendingTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-medium">
                        <span>可提现余额</span>
                        <span>¥{row.currentBalance.toFixed(2)}</span>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
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
                    {row.original.distributor.email}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "amount",
        header: () => <div className="text-right">申请金额</div>,
        cell: ({ row }) => (
            <div className="text-right font-medium">¥{row.original.amount.toFixed(2)}</div>
        ),
    },
    {
        id: "actualAmount",
        header: () => <div className="text-right">实付金额</div>,
        cell: ({ row }) => {
            const { feeAmount, actualAmount, feePercent } = row.original
            return (
                <div className="text-right">
                    <span className="font-medium">¥{actualAmount.toFixed(2)}</span>
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
        cell: ({ row }) => <ReceiptCell url={row.original.receiptImageUrl} />,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status] ?? {
                label: row.original.status,
                variant: "outline" as const,
            }
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="申请时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {new Date(row.original.createdAt).toLocaleString("zh-CN")}
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
    {
        id: "actions",
        header: () => <div className="w-[200px]">操作</div>,
        cell: ({ row }) => (
            <WithdrawalRowActions
                id={row.original.id}
                status={row.original.status}
                amount={row.original.amount}
                feeAmount={row.original.feeAmount}
                feePercent={row.original.feePercent}
                actualAmount={row.original.actualAmount}
                distributorName={row.original.distributor.name}
                distributorEmail={row.original.distributor.email}
                balance={{
                    level1Settled: row.original.level1Settled,
                    level2Settled: row.original.level2Settled,
                    paidTotal: row.original.paidTotal,
                    pendingTotal: row.original.pendingTotal,
                    currentBalance: row.original.currentBalance,
                }}
            />
        ),
    },
]
