"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tag, Clock } from "lucide-react"
import { useFingerprint } from "@/hooks/use-fingerprint"
import { useExitIntent } from "@/hooks/use-exit-intent"
import { hasLocalOrderHistory } from "@/lib/order-history-storage"

type ExitIntentDialogProps = {
    productId: string
    productName: string
    price: number
    inStock: boolean
    /** 由父组件传入，弹窗触发折扣后调用，传递 token 和折扣比例 */
    onDiscount: (token: string, discountPercent: number) => void
}

type DiscountResult =
    | { eligible: true; token: string; expiresAt: number; discountPercent: number }
    | { eligible: false }

async function fetchExitDiscount(
    productId: string,
    fingerprintHash: string
): Promise<DiscountResult> {
    const res = await fetch("/api/exit-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ productId, fingerprintHash }),
    })
    if (!res.ok) return { eligible: false }
    const data = await res.json() as DiscountResult
    return data
}

function useCountdown(expiresAt: number | null): string {
    const [remaining, setRemaining] = useState<number>(0)

    useEffect(() => {
        if (expiresAt === null) return
        const update = () => setRemaining(Math.max(0, expiresAt - Date.now()))
        const init = setTimeout(update, 0)
        const id = setInterval(update, 1000)
        return () => { clearTimeout(init); clearInterval(id) }
    }, [expiresAt])

    const minutes = Math.floor(remaining / 60_000)
    const seconds = Math.floor((remaining % 60_000) / 1000)
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function ExitIntentDialog({
    productId,
    productName,
    price,
    inStock,
    onDiscount,
}: ExitIntentDialogProps) {
    const [open, setOpen] = useState(false)
    const [discountResult, setDiscountResult] = useState<DiscountResult | null>(null)
    const [loading, setLoading] = useState(false)
    const fetchedRef = useRef(false)
    const fingerprintHash = useFingerprint()
    const countdown = useCountdown(
        discountResult?.eligible ? discountResult.expiresAt : null
    )

    const storageKey = `exit-intent:${productId}`

    const handleTrigger = useCallback(async () => {
        if (!inStock) return
        if (!fingerprintHash) return
        if (fetchedRef.current) return
        fetchedRef.current = true

        // 客户端预检：有本地订单历史则不弹
        if (hasLocalOrderHistory()) return

        // 客户端预检：有分销员 promo code cookie 则不弹
        const cookies = document.cookie
        if (cookies.includes("distributor_promo_code=")) return

        setLoading(true)
        try {
            const result = await fetchExitDiscount(productId, fingerprintHash)
            setDiscountResult(result)
            if (result.eligible) {
                setOpen(true)
            }
        } catch {
            // 静默降级
        } finally {
            setLoading(false)
        }
    }, [fingerprintHash, inStock, productId])

    useExitIntent({
        storageKey,
        onTrigger: handleTrigger,
        disabled: !inStock || loading,
    })

    const handleClaim = () => {
        if (!discountResult?.eligible) return
        onDiscount(discountResult.token, discountResult.discountPercent)
        setOpen(false)
        // 滚动到下单表单
        const el = document.getElementById("order-section")
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    if (!discountResult?.eligible) return null

    const discountedPrice = (price * (1 - discountResult.discountPercent / 100)).toFixed(2)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Tag className="size-5 text-primary" />
                        等一下！专属优惠
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        离开挽留折扣弹窗
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border bg-primary/5 p-4 text-center">
                        <p className="text-sm text-muted-foreground">{productName}</p>
                        <div className="mt-2 flex items-baseline justify-center gap-2">
                            <span className="text-3xl font-bold text-primary">
                                ¥{discountedPrice}
                            </span>
                            <span className="text-sm text-muted-foreground line-through">
                                ¥{price.toFixed(2)}
                            </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-primary">
                            立享 {100 - discountResult.discountPercent} 折，仅此一次
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="size-4" />
                        <span>
                            优惠将在 <span className="font-mono font-medium tabular-nums text-foreground">{countdown}</span> 后失效
                        </span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Button onClick={handleClaim} className="w-full">
                            立享 {100 - discountResult.discountPercent} 折，立即购买
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={() => setOpen(false)}
                        >
                            不了，谢谢
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
