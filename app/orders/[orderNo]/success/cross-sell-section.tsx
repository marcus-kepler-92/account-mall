"use client"

import { useState, useSyncExternalStore } from "react"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ProductCard, type ProductCardData } from "@/app/components/product-card"
import { cn } from "@/lib/utils"

type CrossSellRecommendation = {
    product: ProductCardData
    href: string
    discountPercent: number
}

type CrossSellSectionProps = {
    recommendations: CrossSellRecommendation[]
    discountPercent: number
    ttlMs: number
}

// lastTickTime is only updated when the interval fires, never inside getSnapshot,
// so the snapshot is stable between ticks and doesn't cause infinite re-renders.
let lastTickTime = Date.now()

function subscribe(callback: () => void) {
    const id = setInterval(() => {
        lastTickTime = Date.now()
        callback()
    }, 1000)
    return () => clearInterval(id)
}

function useCountdownMs(expiresAt: number): number {
    return useSyncExternalStore(
        subscribe,
        () => Math.max(0, expiresAt - lastTickTime),
        () => Math.max(0, expiresAt - lastTickTime),
    )
}

export function CrossSellSection({ recommendations, discountPercent, ttlMs }: CrossSellSectionProps) {
    const hasDiscount = discountPercent > 0
    const [expiresAt] = useState(() => Date.now() + ttlMs)
    const remainingMs = useCountdownMs(expiresAt)
    const isExpired = hasDiscount && remainingMs <= 0
    const isUrgent = hasDiscount && remainingMs <= 2 * 60_000 && !isExpired   // < 2 min
    const isCritical = hasDiscount && remainingMs <= 60_000 && !isExpired     // < 1 min
    const minutes = Math.floor(remainingMs / 60_000)
    const seconds = Math.floor((remainingMs % 60_000) / 1000)
    const countdownStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    const discountLabel = `${100 - discountPercent} 折`

    return (
        <section className="mx-auto max-w-4xl px-4">
            {/* Banner — only shown when a discount is configured */}
            {hasDiscount && (
                <Card className={cn(
                    "mb-3 transition-all duration-500",
                    isExpired && "opacity-50",
                    isCritical && "border-destructive/60 bg-destructive/5",
                    isUrgent && !isCritical && "border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20",
                )}>
                    <CardContent className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className={cn(
                                    "font-semibold text-sm",
                                    isCritical && "text-destructive",
                                    isUrgent && !isCritical && "text-orange-600 dark:text-orange-400",
                                )}>
                                    <Sparkles className="inline size-3.5 mr-1 text-amber-500" />
                                    为你推荐 · 专享{discountLabel}
                                </p>
                                <p className={cn(
                                    "text-xs",
                                    isCritical ? "text-destructive/80 font-medium" :
                                    isUrgent ? "text-orange-500 dark:text-orange-400" :
                                    "text-muted-foreground"
                                )}>
                                    {isExpired ? "折扣已过期" :
                                     isCritical ? "⚠ 即将过期，抓紧下单！" :
                                     isUrgent ? "即将过期，仅剩最后几秒" :
                                     "仅本页有效 · 限时专享"}
                                </p>
                            </div>
                            {!isExpired && (
                                <span className={cn(
                                    "font-mono tabular-nums font-bold text-lg shrink-0 transition-colors duration-500",
                                    isCritical ? "text-destructive animate-pulse" :
                                    isUrgent ? "text-orange-500 dark:text-orange-400" :
                                    "text-foreground"
                                )}>
                                    {countdownStr}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Minimal header when no discount */}
            {!hasDiscount && (
                <p className="mb-3 text-sm font-semibold">
                    <Sparkles className="inline size-4 mr-1 text-amber-500" />
                    为你推荐
                </p>
            )}

            {/* Product list — horizontal cards stacked vertically */}
            <div className={cn(
                "flex flex-col gap-3 transition-opacity",
                isExpired ? "opacity-50 pointer-events-none" : ""
            )}>
                {recommendations.map((rec) => (
                    <ProductCard
                        key={rec.product.id}
                        product={rec.product}
                        href={rec.href}
                        discountPercent={rec.discountPercent}
                        horizontal
                    />
                ))}
            </div>
        </section>
    )
}
