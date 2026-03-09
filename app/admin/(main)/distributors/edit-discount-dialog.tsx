"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Loader2 } from "lucide-react"

type EditDiscountDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    distributorId: string
    distributorCode: string | null
    discountCodeEnabled: boolean
    discountPercent: number | null
    onSuccess: () => void
}

export function EditDiscountDialog({
    open,
    onOpenChange,
    distributorId,
    distributorCode,
    discountCodeEnabled,
    discountPercent,
    onSuccess,
}: EditDiscountDialogProps) {
    const [loading, setLoading] = useState(false)
    const [enabled, setEnabled] = useState(discountCodeEnabled)
    const [percent, setPercent] = useState(discountPercent != null ? String(discountPercent) : "")

    useEffect(() => {
        if (open) {
            setEnabled(discountCodeEnabled)
            setPercent(discountPercent != null ? String(discountPercent) : "")
        }
    }, [open, discountCodeEnabled, discountPercent])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const pctNum = percent.trim() === "" ? null : parseFloat(percent)
        if (enabled && (pctNum == null || Number.isNaN(pctNum) || pctNum < 0 || pctNum > 100)) {
            toast.error("启用优惠码时请填写 0–100 的折扣比例")
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${distributorId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discountCodeEnabled: enabled,
                    discountPercent: enabled && pctNum != null ? pctNum : null,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error?.message?.[0] || err.error || "保存失败")
                return
            }
            toast.success("已保存")
            onOpenChange(false)
            onSuccess()
        } catch {
            toast.error("保存失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>优惠码设置</DialogTitle>
                    <DialogDescription>
                        {distributorCode ? (
                            <>推荐码 <code className="font-mono text-xs">{distributorCode}</code> 作为优惠码时，仅当开启下方开关并设置折扣比例后，访客下单才享受折扣。</>
                        ) : (
                            "该分销员暂无推荐码，请先确保其已生成推荐码。"
                        )}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                        <Label htmlFor="discount-enabled">启用优惠码</Label>
                        <Switch
                            id="discount-enabled"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                    </div>
                    {enabled && (
                        <div className="space-y-2">
                            <Label htmlFor="discount-percent">折扣比例（%）</Label>
                            <Input
                                id="discount-percent"
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                placeholder="如 5 表示 5%"
                                value={percent}
                                onChange={(e) => setPercent(e.target.value)}
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                            保存
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
