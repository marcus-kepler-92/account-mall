"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProductPriceSyncStore } from "@/lib/stores/product-price-sync"
import { useTurnstileStore } from "@/lib/stores/turnstile"

const ORDER_FORM_LOADING_EVENT = "product-order-loading"

type ProductBottomBarProps = {
    price: number
    inStock: boolean
    orderSectionId: string
    formId?: string
    isFree?: boolean
    requireTurnstile?: boolean
    // MANUAL products use per-variant pricing and have their own dun-发货 flow
    // on the order page, so the catalog price (¥0.00) and the 催货 CTA aren't
    // meaningful here. Bottom bar swaps to a min-price label + a 联系客服 CTA
    // when the variant list is fully out of stock.
    isManual?: boolean
    manualPriceMin?: number | null
    manualPriceMax?: number | null
}

export function ProductBottomBar({
    price,
    inStock,
    orderSectionId,
    formId,
    isFree,
    requireTurnstile = false,
    isManual = false,
    manualPriceMin = null,
    manualPriceMax = null,
}: ProductBottomBarProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const d = useProductPriceSyncStore((s) => s.display)
    const turnstileStatus = useTurnstileStore((s) => s.status)

    useEffect(() => {
        const handler = (e: CustomEvent<{ loading: boolean }>) => {
            setIsSubmitting(e.detail.loading)
        }
        document.addEventListener(ORDER_FORM_LOADING_EVENT, handler as EventListener)
        return () => document.removeEventListener(ORDER_FORM_LOADING_EVENT, handler as EventListener)
    }, [])

    const turnstileLoading =
        requireTurnstile &&
        turnstileStatus !== "ready" &&
        turnstileStatus !== "unsupported"

    const handleClick = () => {
        if (inStock && formId && !isSubmitting) {
            if (turnstileLoading) return

            const form = document.getElementById(formId) as HTMLFormElement
            if (form) {
                form.requestSubmit()
                return
            }
        }

        if (isSubmitting) return

        if (!inStock) {
            // MANUAL has no restock-subscription path; just scroll to the order
            // section where the contact-customer-service hint is rendered.
            if (isManual) {
                const el = document.getElementById(orderSectionId)
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
                return
            }
            document.dispatchEvent(new CustomEvent("open-restock-dialog"))
            return
        }

        const el = document.getElementById(orderSectionId)
        if (!el) return
        el.scrollIntoView({ behavior: "smooth", block: "start" })
    }

    const showSubmitState = inStock && isSubmitting

    const displayFree = d ? d.isFreeShared : isFree
    // MANUAL: prefer live variant price from the sync store (driven by the
    // variant selector); fall back to the min-price range hint if the user
    // hasn't picked a variant yet, otherwise dash.
    const manualFallback =
        manualPriceMin != null && manualPriceMax != null
            ? manualPriceMin === manualPriceMax
                ? manualPriceMin.toFixed(2)
                : `${manualPriceMin.toFixed(2)} 起`
            : "—"
    const displayPrice = d && !d.isFreeShared
        ? d.totalPrice
        : isManual
          ? manualFallback
          : price.toFixed(2)
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
                                !inStock && !isManual && "text-muted-foreground line-through",
                                !inStock && isManual && "text-muted-foreground"
                            )}
                        >
                            {displayFree ? "免费" : `¥${displayPrice}`}
                        </span>
                        {inStock && hasDiscount && d?.discountPercent != null && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                已享 {d.discountPercent}% 优惠
                            </span>
                        )}
                        {!inStock && !isManual && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                已售罄，催货告诉我们你要
                            </span>
                        )}
                        {!inStock && isManual && (
                            <span className="mt-0.5 text-[11px] text-muted-foreground">
                                暂无库存，可联系客服
                            </span>
                        )}
                    </div>
                </div>
                <Button
                    type="button"
                    size="lg"
                    className="min-h-11 min-w-28 gap-2 touch-manipulation"
                    onClick={handleClick}
                    disabled={isSubmitting || (inStock && turnstileLoading)}
                >
                    {(showSubmitState || (inStock && turnstileLoading && turnstileStatus !== "interactive")) && (
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                    )}
                    {showSubmitState
                        ? "提交中…"
                        : inStock && turnstileStatus === "interactive"
                          ? "请先完成安全验证 ↑"
                          : inStock && turnstileLoading
                            ? "准备中…"
                            : inStock
                              ? (isFree ? "免费领取" : "立即购买")
                              : isManual
                                ? "联系客服"
                                : "催货"}
                </Button>
            </div>
        </div>
    )
}
