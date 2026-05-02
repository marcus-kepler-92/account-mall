"use client"

import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import type { WithdrawalRow } from "./withdrawals-columns"

interface WithdrawalProcessSheetProps {
    row: WithdrawalRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
}

export function WithdrawalProcessSheet({
    row,
    open,
    onOpenChange,
    onSuccess,
}: WithdrawalProcessSheetProps) {
    const [action, setAction] = useState<"PAID" | "REJECTED" | null>(null)
    const [note, setNote] = useState("")
    const [loading, setLoading] = useState(false)

    const resetDialog = () => {
        setAction(null)
        setNote("")
        setLoading(false)
    }

    const handleConfirm = async () => {
        if (!action || !row) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/withdrawals/${row.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: action, note: note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? "操作失败")
                return
            }
            toast.success(action === "PAID" ? "已标记打款" : "已拒绝")
            resetDialog()
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    if (!row) return null

    const statusConfig = {
        PENDING: { label: "待处理", variant: "warning" as const },
        PAID: { label: "已打款", variant: "success" as const },
        REJECTED: { label: "已拒绝", variant: "destructive" as const },
    }

    const {
        distributor,
        amount,
        feeAmount,
        feePercent,
        actualAmount,
        receiptImageUrl,
        level1Settled,
        level2Settled,
        paidTotal,
        pendingTotal,
        currentBalance,
    } = row

    return (
        <>
            <Sheet
                open={open}
                onOpenChange={(o) => {
                    if (!o) resetDialog()
                    onOpenChange(o)
                }}
            >
                <SheetContent className="flex flex-col w-full sm:max-w-md">
                    <SheetHeader className="border-b pb-4 shrink-0">
                        <SheetTitle className="flex items-center gap-2 flex-wrap">
                            {distributor.name}
                            <Badge variant={statusConfig[row.status].variant} className="text-xs">
                                {statusConfig[row.status].label}
                            </Badge>
                        </SheetTitle>
                        <p className="text-sm text-muted-foreground">
                            {distributor.email ?? distributor.username ?? "—"} · {formatDateTime(row.createdAt)}
                        </p>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Amount banner */}
                        <div className="rounded-lg bg-primary/10 px-4 py-3 text-center">
                            <p className="text-xs font-semibold text-primary mb-1">打款金额</p>
                            <p className="text-3xl font-bold tabular-nums text-primary">
                                {formatCurrency(actualAmount)}
                            </p>
                            {feeAmount > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    申请 {formatCurrency(amount)} · 手续费 {feePercent}% = -{formatCurrency(feeAmount)}
                                </p>
                            )}
                        </div>

                        {/* QR code */}
                        {receiptImageUrl ? (
                            <div className="flex justify-center overflow-hidden rounded-md border bg-muted/30 p-4">
                                <Image
                                    src={receiptImageUrl}
                                    alt="收款码"
                                    width={600}
                                    height={600}
                                    className="max-h-[40vh] max-w-full object-contain"
                                />
                            </div>
                        ) : (
                            <p className="text-center text-sm text-muted-foreground">未上传收款码</p>
                        )}

                        <Separator />

                        {/* Balance details */}
                        <div>
                            <h4 className="text-sm font-medium mb-3">余额明细</h4>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">一级佣金（已结算）</span>
                                    <span className="tabular-nums">¥{level1Settled.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">二级佣金（已结算）</span>
                                    <span className="tabular-nums">¥{level2Settled.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between">
                                    <span className="text-muted-foreground">已打款</span>
                                    <span className="tabular-nums">-¥{paidTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">提现中（含本次）</span>
                                    <span className="tabular-nums">-¥{pendingTotal.toFixed(2)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-medium">
                                    <span>可提现余额</span>
                                    <span className="tabular-nums">¥{currentBalance.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <Button className="flex-1" onClick={() => setAction("PAID")}>
                                <CheckCircle className="size-4" />
                                已打款
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive"
                                onClick={() => setAction("REJECTED")}
                            >
                                <XCircle className="size-4" />
                                拒绝
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <AlertDialog
                open={!!action}
                onOpenChange={(o) => { if (!o) resetDialog() }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {action === "PAID" ? "确认已打款" : "确认拒绝"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {distributor.name} 申请提现 {formatCurrency(amount)}
                            {feeAmount > 0 && (
                                <>，实付 <strong>{formatCurrency(actualAmount)}</strong></>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="px-1 pb-2 space-y-1.5">
                        <Label>备注（可选）</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={action === "PAID" ? "打款方式、流水号等" : "拒绝原因"}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={loading}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirm() }}
                            disabled={loading}
                        >
                            {loading && <Loader2 className="size-4 animate-spin" />}
                            {action === "PAID" ? "确认已打款" : "确认拒绝"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
