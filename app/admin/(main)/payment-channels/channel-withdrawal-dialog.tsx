"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    channelId: string
    channelNickname: string
}

export function ChannelWithdrawalDialog({ open, onOpenChange, channelId, channelNickname }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [amount, setAmount] = useState("")
    const [note, setNote] = useState("")

    const handleSubmit = async () => {
        const amountNum = parseFloat(amount)
        if (Number.isNaN(amountNum) || amountNum <= 0) {
            toast.error("请填写有效金额")
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/payment-channels/${channelId}/withdrawals`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount: amountNum, note: note || undefined }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "操作失败")
                return
            }
            toast.success("提现记录已保存")
            setAmount("")
            setNote("")
            onOpenChange(false)
            router.refresh()
        } catch {
            toast.error("操作失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>记录提现</DialogTitle>
                    <DialogDescription>{channelNickname}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>提现金额 (元)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>备注（可选）</Label>
                        <Input
                            placeholder="如：提到招商银行 xxx"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "保存中..." : "确认"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
