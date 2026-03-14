"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

type BalanceDetail = {
    level1Settled: number
    level2Settled: number
    paidTotal: number
    pendingTotal: number
    currentBalance: number
}

type WithdrawalRowActionsProps = {
    id: string
    status: string
    amount: number
    feePercent?: number
    feeAmount?: number
    actualAmount?: number
    distributorName: string
    distributorEmail: string
    balance: BalanceDetail
}

export function WithdrawalRowActions({
    id,
    status,
    amount,
    feePercent = 0,
    feeAmount = 0,
    actualAmount,
    distributorName,
    distributorEmail,
    balance,
}: WithdrawalRowActionsProps) {
    const displayActualAmount = actualAmount ?? amount
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [dialog, setDialog] = useState<{
        action: "PAID" | "REJECTED"
        note: string
    } | null>(null)

    const handleSubmit = async () => {
        if (!dialog) return
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/withdrawals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: dialog.action, note: dialog.note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success(dialog.action === "PAID" ? "已标记打款" : "已拒绝")
            setDialog(null)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    if (status !== "PENDING") return null

    return (
        <>
            <div className="flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ action: "PAID", note: "" })}
                >
                    <CheckCircle className="size-4" />
                    标记已打款
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDialog({ action: "REJECTED", note: "" })}
                >
                    <XCircle className="size-4" />
                    拒绝
                </Button>
            </div>
            <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>处理提现申请</DialogTitle>
                        <DialogDescription>
                            {distributorName}（{distributorEmail}）申请提现 ¥{amount.toFixed(2)}
                            {feeAmount > 0 && (
                                <>，手续费 {feePercent}% = ¥{feeAmount.toFixed(2)}，<strong>实付 ¥{displayActualAmount.toFixed(2)}</strong></>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Balance breakdown */}
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1.5">
                            <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">
                                当前余额明细
                            </p>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">一级佣金（已结算）</span>
                                <span>¥{balance.level1Settled.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">二级佣金（已结算）</span>
                                <span>¥{balance.level2Settled.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-1.5 flex justify-between">
                                <span className="text-muted-foreground">已打款</span>
                                <span>-¥{balance.paidTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">提现中（含本次）</span>
                                <span>-¥{balance.pendingTotal.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-1.5 flex justify-between font-medium">
                                <span>可提现余额</span>
                                <span>¥{balance.currentBalance.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>备注</Label>
                            <Input
                                value={dialog?.note ?? ""}
                                onChange={(e) =>
                                    dialog && setDialog({ ...dialog, note: e.target.value })
                                }
                                placeholder={
                                    dialog?.action === "PAID" ? "打款方式、流水号等" : "拒绝原因"
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)}>
                            取消
                        </Button>
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading && <Loader2 className="size-4 animate-spin" />}
                            {dialog?.action === "PAID" ? "确认已打款" : "确认拒绝"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
