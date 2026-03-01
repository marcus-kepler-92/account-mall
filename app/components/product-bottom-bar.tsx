"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

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

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden">
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
                            {isFreeShared ? "免费" : `¥${price.toFixed(2)}`}
                        </span>
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
                    className="min-w-28 gap-2"
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

