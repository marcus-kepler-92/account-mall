"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProductPriceSyncStore } from "@/lib/stores/product-price-sync"

const ORDER_FORM_LOADING_EVENT = "product-order-loading"

type ProductBottomBarProps = {
    price: number
    inStock: boolean
    orderSectionId: string
    restockSectionId?: string
    formId?: string
    isFreeShared?: boolean
}

export function ProductBottomBar({
    price,
    inStock,
    orderSectionId,
    restockSectionId,
    formId,
    isFreeShared,
}: ProductBottomBarProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const d = useProductPriceSyncStore((s) => s.display)

    useEffect(() => {
        const handler = (e: CustomEvent<{ loading: boolean }>) => {
            setIsSubmitting(e.detail.loading)
        }
        document.addEventListener(ORDER_FORM_LOADING_EVENT, handler as EventListener)
        return () => document.removeEventListener(ORDER_FORM_LOADING_EVENT, handler as EventListener)
    }, [])

    const handleClick = () => {
        if (inStock && formId && !isSubmitting) {
            const form = document.getElementById(formId) as HTMLFormElement
            if (form) {
                form.requestSubmit()
                return
            }
        }

        if (isSubmitting) return

        const targetId = inStock ? orderSectionId : restockSectionId ?? orderSectionId
        if (!targetId) return

        const el = document.getElementById(targetId)
        if (!el) return

        el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    const showSubmitState = inStock && isSubmitting

    const displayFree = d ? d.isFreeShared : isFreeShared
    const displayPrice = d && !d.isFreeShared ? d.totalPrice : price.toFixed(2)
    const hasDiscount = Boolean(d?.discountPercent != null && d.discountPercent > 0)

    return (
        <div
            className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur dark:shadow-[0_-4px_12px_rgba(0,0,0,0.25)] lg:hidden pb-3 supports-[padding:env(safe-area-inset-bottom)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            role="banner"
            aria-label="商品操作栏"
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 2xl:max-w-7xl">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">
                            {inStock ? "到手价" : "当前状态"}
                        </span>
                        <span
                            className={cn(
                                "text-lg font-bold tabular-nums",
                                !inStock && "text-muted-foreground line-through"
                            )}
                        >
                            {displayFree ? "免费" : `¥${displayPrice}`}
                        </span>
                        {inStock && hasDiscount && d?.discountPercent != null && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                已享 {d.discountPercent}% 优惠
                            </span>
                        )}
                        {!inStock && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                已售罄，可订阅补货提醒
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    type="button"
                    size="lg"
                    className="min-h-11 min-w-28 gap-2 touch-manipulation"
                    onClick={handleClick}
                    disabled={(!inStock && !restockSectionId) || isSubmitting}
                >
                    {showSubmitState && (
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    )}
                    {showSubmitState ? "提交中…" : inStock ? (isFreeShared ? "领取" : "立即购买") : "补货提醒"}
                </Button>
            </div>
        </div>
    )
}

