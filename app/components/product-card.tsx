"use client"

import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Package, Bell, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { descriptionToPlainText } from "@/lib/description"
import { SoldOutOverlay } from "@/app/components/sold-out-overlay"
import { configClient } from "@/lib/config-client"

export type ProductCardData = {
    id: string
    name: string
    slug: string
    description: string | null
    summary?: string | null
    image: string | null
    price: number
    stock: number
    productType?: "NORMAL" | "AUTO_FETCH"
    tags: { id: string; name: string; slug: string }[]
    // Set by /api/products when ?cs=<token> is present and this product is an
    // eligible cross-sell target of the source order's product. Absent for
    // anonymous browsing or expired sessions. Grid-level renderers should
    // forward this to <ProductCard discountPercent={...}>.
    discountPercent?: number
}

type ProductCardProps = {
    product: ProductCardData
    gradientIndex?: number
    className?: string
    code?: string
    cs?: string
    discountPercent?: number
    href?: string
    horizontal?: boolean
}

/**
 * Product card with equal height in grid, cover maintains aspect ratio (1:1).
 */
export function ProductCard({ product, gradientIndex = 0, className, code, cs, discountPercent, href, horizontal }: ProductCardProps) {
    const descriptionFallback = descriptionToPlainText(product.description, 80)
    const briefRaw = product.summary?.trim() || descriptionFallback
    const brief = briefRaw.slice(0, 80)
    const isAutoFetch = product.productType === "AUTO_FETCH"
    const isFree = isAutoFetch && product.price === 0
    const isSoldOut = !isAutoFetch && product.stock === 0
    const isLowStock = !isAutoFetch && !isSoldOut && product.stock > 0 && product.stock <= configClient.lowStockThreshold
    const buildDetailHref = () => {
        const params = new URLSearchParams()
        if (isSoldOut) params.set("restock", "1")
        if (code) params.set("code", code)
        if (cs) params.set("cs", cs)
        const query = params.toString()
        return `/products/${product.slug}${query ? `?${query}` : ""}`
    }
    const detailHref = href ?? buildDetailHref()
    const hasDiscount = typeof discountPercent === "number" && discountPercent > 0 && discountPercent <= 99 && product.price > 0

    if (horizontal) {
        const firstTag = product.tags[0]
        return (
            <Link href={detailHref} className={cn("group block", className)}>
                <div className="flex items-center gap-3 rounded-xl bg-card p-2.5 shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.08] transition-all duration-200 hover:shadow-md hover:ring-primary/30">
                    {/* 48px thumbnail */}
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {product.image ? (
                            <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="48px"
                                className={cn("object-fill", isSoldOut && "grayscale")}
                                priority={gradientIndex === 0}
                            />
                        ) : (
                            <div className="flex size-full items-center justify-center">
                                <Package className="size-4 text-muted-foreground/40" />
                            </div>
                        )}
                        {isSoldOut && <SoldOutOverlay />}
                    </div>

                    {/* Name + tag */}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight transition-colors group-hover:text-primary">
                            {product.name}
                        </p>
                        {firstTag && (
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{firstTag.name}</p>
                        )}
                    </div>

                    {/* Price */}
                    <div className="shrink-0 text-right tabular-nums">
                        {isFree ? (
                            <span className="text-sm font-bold text-primary">免费</span>
                        ) : !isSoldOut && hasDiscount ? (
                            <>
                                <p className="text-[11px] text-muted-foreground line-through leading-tight">¥{product.price.toFixed(2)}</p>
                                <p className="text-sm font-bold text-destructive leading-tight">¥{(product.price * (1 - discountPercent! / 100)).toFixed(2)}</p>
                            </>
                        ) : (
                            <span className={cn("text-sm font-bold", isSoldOut && "text-muted-foreground line-through")}>
                                ¥{product.price.toFixed(2)}
                            </span>
                        )}
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
            </Link>
        )
    }

    return (
        <Link href={detailHref} className={cn("group block h-full", className)}>
            <Card
                className={cn(
                    "relative flex h-full flex-col gap-0 overflow-hidden border p-0 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/20 group-focus-within:ring-2 group-focus-within:ring-ring"
                )}
            >
                {/* Cover: 1:1 aspect ratio, image preserves ratio via object-cover */}
                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-muted">
                    {product.image ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, (max-width: 1600px) 20vw, 16vw"
                            className={cn(
                                "object-fill transition-all duration-300 group-hover:scale-105",
                                isSoldOut && "grayscale"
                            )}
                            priority={gradientIndex === 0}
                        />
                    ) : (
                        <div className="flex size-full items-center justify-center">
                            <Package className="size-8 text-muted-foreground/40 transition-transform duration-300 group-hover:scale-110 sm:size-12" />
                        </div>
                    )}
                    {isSoldOut && <SoldOutOverlay />}
                </div>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-1 px-3 py-2 sm:gap-3 sm:p-4">
                    <div className="flex flex-wrap gap-1 overflow-hidden max-h-5 sm:max-h-none">
                        {product.tags.map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-[10px] font-normal opacity-80"
                            >
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary sm:text-base">
                        {product.name}
                    </h3>
                    {brief && (
                        <p className="line-clamp-2 hidden flex-1 text-sm text-muted-foreground sm:block">
                            {brief}
                            {briefRaw.length > 80 ? "…" : ""}
                        </p>
                    )}
                </CardContent>

                <div className="shrink-0 border-t px-3 py-2 sm:px-4 sm:py-3">
                    <div className="flex w-full items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {isFree ? (
                                <>
                                    <span className="text-base font-bold tabular-nums text-primary sm:text-lg">免费</span>
                                    <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                        可领取
                                    </span>
                                </>
                            ) : (
                                <>
                                    {!isSoldOut && hasDiscount ? (
                                        <span className="flex flex-col leading-tight">
                                            <span className="line-through text-muted-foreground text-[11px]">¥{product.price.toFixed(2)}</span>
                                            <span className="font-bold text-destructive text-base tabular-nums sm:text-lg">¥{(product.price * (1 - discountPercent! / 100)).toFixed(2)}</span>
                                        </span>
                                    ) : (
                                        <span
                                            className={cn(
                                                "text-base font-bold tabular-nums sm:text-lg",
                                                isSoldOut && "text-muted-foreground line-through"
                                            )}
                                        >
                                            ¥{product.price.toFixed(2)}
                                        </span>
                                    )}
                                    {isAutoFetch ? (
                                        <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                            有货
                                        </span>
                                    ) : isLowStock ? (
                                        <span className="ml-1.5 block text-[11px] font-medium text-orange-500 dark:text-orange-400">
                                            仅剩 {product.stock} 件
                                        </span>
                                    ) : product.stock > 0 ? (
                                        <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                            库存 {product.stock}
                                        </span>
                                    ) : (
                                        <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                            已售罄
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <Button size="sm" className="shrink-0" disabled={false}>
                            {isSoldOut ? (
                                <>
                                    <Bell className="size-3.5" />
                                    <span className="text-xs sm:text-sm">催货</span>
                                </>
                            ) : isFree ? (
                                <span className="text-xs sm:text-sm">免费领取</span>
                            ) : (
                                <span className="text-xs sm:text-sm">立即购买</span>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>
        </Link>
    )
}

/**
 * Skeleton placeholder for ProductCard, same structure for equal height.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
    return (
        <div className={cn("flex h-full flex-col overflow-hidden rounded-xl border", className)}>
            <div className="aspect-square shrink-0 animate-pulse bg-muted" />
            <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 py-2 sm:gap-3 sm:p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="hidden h-3 w-1/2 animate-pulse rounded bg-muted sm:block" />
            </div>
            <div className="flex shrink-0 items-center justify-between border-t px-3 py-2 sm:px-4 sm:py-3">
                <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                <div className="h-8 w-14 animate-pulse rounded bg-muted" />
            </div>
        </div>
    )
}
