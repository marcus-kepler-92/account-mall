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

type WithdrawalRowActionsProps = {
    id: string
    status: string
}

export function WithdrawalRowActions({ id, status }: WithdrawalRowActionsProps) {
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialog?.action === "PAID" ? "标记已打款" : "拒绝提现"}
                        </DialogTitle>
                        <DialogDescription>
                            {dialog?.action === "PAID"
                                ? "请填写打款方式或流水号等备注（可选）"
                                : "请填写拒绝原因（可选）"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
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
