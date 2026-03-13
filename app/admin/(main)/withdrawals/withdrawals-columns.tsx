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
import { DataTableColumnHeader } from "@/app/admin/components"
import { WithdrawalRowActions } from "./withdrawal-row-actions"

export type WithdrawalRow = {
    id: string
    distributorId: string
    distributor: { id: string; email: string; name: string }
    amount: number
    status: string
    receiptImageUrl: string | null
    note: string | null
    processedAt: string | null
    createdAt: string
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
        header: () => <div className="text-right">金额</div>,
        cell: ({ row }) => (
            <div className="text-right font-medium">¥{row.original.amount.toFixed(2)}</div>
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
        header: () => <div className="w-[180px]">操作</div>,
        cell: ({ row }) => (
            <WithdrawalRowActions id={row.original.id} status={row.original.status} />
        ),
    },
]
