"use client"

import { useState, useSyncExternalStore } from "react"
import { Sparkles } from "lucide-react"

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
    const isUrgent = hasDiscount && remainingMs <= 3 * 60_000 && !isExpired   // < 3 min
    const isCritical = hasDiscount && remainingMs <= 60_000 && !isExpired     // < 1 min
    const progressPct = Math.max(0, (remainingMs / ttlMs) * 100)
    const minutes = Math.floor(remainingMs / 60_000)
    const seconds = Math.floor((remainingMs % 60_000) / 1000)
    const countdownStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    const discountLabel = `${100 - discountPercent} 折`

    return (
        <section className="mx-auto max-w-4xl px-4">
            {/* Banner — only shown when a discount is configured */}
            {hasDiscount && (
                <div className={cn(
                    "mb-3 rounded-xl border overflow-hidden transition-all duration-700",
                    isExpired && "opacity-40",
                    isCritical ? "border-destructive/70 bg-destructive/5 shadow-[0_0_12px_rgba(239,68,68,0.15)]" :
                    isUrgent ? "border-orange-400/70 bg-orange-50/60 dark:bg-orange-950/25 shadow-[0_0_10px_rgba(251,146,60,0.15)]" :
                    "border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20",
                )}>
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                            <p className={cn(
                                "font-semibold text-sm leading-tight",
                                isCritical ? "text-destructive" :
                                isUrgent ? "text-orange-600 dark:text-orange-400" :
                                "text-amber-700 dark:text-amber-400",
                            )}>
                                <Sparkles className="inline size-3.5 mr-1" />
                                专享{discountLabel} · 限时优惠
                            </p>
                            <p className={cn(
                                "text-xs mt-0.5",
                                isCritical ? "text-destructive font-semibold" :
                                isUrgent ? "text-orange-500 dark:text-orange-400 font-medium" :
                                "text-amber-600/80 dark:text-amber-500/80"
                            )}>
                                {isExpired ? "折扣已过期" :
                                 isCritical ? "🔥 最后机会，即将失效！" :
                                 isUrgent ? "⏳ 快过期了，赶紧下单" :
                                 "离开页面即失效"}
                            </p>
                        </div>
                        {!isExpired && (
                            <span className={cn(
                                "font-mono tabular-nums font-black text-2xl shrink-0 tracking-tight transition-colors duration-500",
                                isCritical ? "text-destructive animate-pulse" :
                                isUrgent ? "text-orange-500 dark:text-orange-400" :
                                "text-amber-600 dark:text-amber-400",
                            )}>
                                {countdownStr}
                            </span>
                        )}
                    </div>
                    {/* Depleting progress bar */}
                    {!isExpired && (
                        <div className="h-1 w-full bg-black/5 dark:bg-white/10">
                            <div
                                className={cn(
                                    "h-full transition-[width] duration-1000 ease-linear",
                                    isCritical ? "bg-destructive" :
                                    isUrgent ? "bg-orange-400" :
                                    "bg-amber-400",
                                )}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                    )}
                </div>
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
