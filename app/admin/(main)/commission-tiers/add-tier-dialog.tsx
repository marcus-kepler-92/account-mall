"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus } from "lucide-react"

export function AddTierDialog() {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [minAmount, setMinAmount] = useState("")
    const [maxAmount, setMaxAmount] = useState("")
    const [ratePercent, setRatePercent] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const min = parseFloat(minAmount)
        const max = parseFloat(maxAmount)
        const rate = parseFloat(ratePercent)
        if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(rate) || min < 0 || max < 0 || rate < 0 || rate > 100) {
            toast.error("请输入有效数字，佣金比例 0–100")
            return
        }
        if (min >= max) {
            toast.error("销售额下限必须小于上限")
            return
        }
        setLoading(true)
        try {
            const res = await fetch("/api/admin/commission-tiers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    minAmount: min,
                    maxAmount: max,
                    ratePercent: rate,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || "添加失败")
                return
            }
            toast.success("已添加")
            setOpen(false)
            setMinAmount("")
            setMaxAmount("")
            setRatePercent("")
            router.refresh()
        } catch {
            toast.error("添加失败")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="size-4 mr-1" />
                    添加档位
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>添加阶梯档位</DialogTitle>
                    <DialogDescription>
                        当周该分销员已完成订单金额落入 [下限, 上限) 时，阶梯佣金 = 订单金额 × 佣金比例%。
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>当周销售额下限（元）</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={minAmount}
                                onChange={(e) => setMinAmount(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>当周销售额上限（元）</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={maxAmount}
                                onChange={(e) => setMaxAmount(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>佣金比例（%）</Label>
                        <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={ratePercent}
                            onChange={(e) => setRatePercent(e.target.value)}
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            取消
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="size-4 animate-spin" /> : "添加"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
