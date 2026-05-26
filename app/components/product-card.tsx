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
    // MANUAL products price on variants (Product.price is always 0). Populated
    // by /api/products and the homepage server fetch with the min/max active
    // variant price. null when no active variants exist (degenerate case).
    priceMin?: number | null
    priceMax?: number | null
    stock: number
    productType?: "NORMAL" | "AUTO_FETCH" | "MANUAL"
    // MANUAL only: when false (default), the buyer side treats stock as
    // unbounded — no "已售罄" / "仅剩 N 件" labels (sellers don't maintain a
    // numeric count). When true, normal low-stock / sold-out rules apply.
    inventoryTracked?: boolean
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
    const isManual = product.productType === "MANUAL"
    const isUntrackedManual = isManual && product.inventoryTracked !== true
    const isFree = isAutoFetch && product.price === 0
    // Untracked MANUAL is treated as always-in-stock — sold-out is gated only
    // by variant.isActive (handled upstream by setting stock=1 sentinel).
    const isSoldOut = !isAutoFetch && !isUntrackedManual && product.stock === 0
    // Untracked MANUAL also skips the low-stock label: the stock=1 sentinel
    // would otherwise be mis-read as "仅剩 1 件".
    const isLowStock = !isAutoFetch && !isUntrackedManual && !isSoldOut && product.stock > 0 && product.stock <= configClient.lowStockThreshold
    // MANUAL 商品不支持到货提醒（restock-subscriptions API 拒绝），
    // 因此即使售罄也不展示「催货」按钮 / 不在 URL 写 restock=1。
    const canRestock = isSoldOut && !isManual
    const buildDetailHref = () => {
        const params = new URLSearchParams()
        if (canRestock) params.set("restock", "1")
        if (code) params.set("code", code)
        if (cs) params.set("cs", cs)
        const query = params.toString()
        return `/products/${product.slug}${query ? `?${query}` : ""}`
    }
    const detailHref = href ?? buildDetailHref()
    // For MANUAL products with active variants we show the variant min price
    // (Product.price is always 0 for MANUAL). When min !== max we suffix "起"
    // to signal a range. `basePrice` is the numeric value the discount math
    // applies to — either the variant min or the legacy Product.price.
    const displayPrice: { label: string; basePrice: number; suffix: string } =
        isManual && product.priceMin != null
            ? product.priceMin === product.priceMax
                ? { label: `¥${product.priceMin.toFixed(2)}`, basePrice: product.priceMin, suffix: "" }
                : { label: `¥${product.priceMin.toFixed(2)} 起`, basePrice: product.priceMin, suffix: " 起" }
            : { label: `¥${product.price.toFixed(2)}`, basePrice: product.price, suffix: "" }
    const hasDiscount = typeof discountPercent === "number" && discountPercent > 0 && discountPercent <= 99 && displayPrice.basePrice > 0
    const discountedLabel = hasDiscount
        ? `¥${(displayPrice.basePrice * (1 - discountPercent! / 100)).toFixed(2)}${displayPrice.suffix}`
        : null

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
                                <p className="text-[11px] text-muted-foreground line-through leading-tight">{displayPrice.label}</p>
                                <p className="text-sm font-bold text-destructive leading-tight">{discountedLabel}</p>
                            </>
                        ) : (
                            <span className={cn("text-sm font-bold", isSoldOut && "text-muted-foreground line-through")}>
                                {displayPrice.label}
                            </span>
                        )}
                    </div>

                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
            </Link>
        )
    }

    // Stock chip rendered as an overlay badge on the cover (top-left). Three
    // visual weights:
    //   urgent  → low-stock; solid destructive + pulse to scream "act now"
    //   success → in-stock signal for AUTO_FETCH / untracked-MANUAL
    //   muted   → neutral count for normal in-stock products
    //
    // Sold-out is intentionally null — SoldOutOverlay already surfaces the
    // "售罄" badge + scrim on the cover; a chip would double-label the card.
    const stockChip: { label: string; tone: "urgent" | "success" | "muted" } | null =
        isFree || isSoldOut
            ? null
            : isLowStock
              ? { label: `仅剩 ${product.stock} 件`, tone: "urgent" }
              : isAutoFetch || isUntrackedManual
                ? { label: "有货", tone: "success" }
                : product.stock > 0
                  ? { label: `库存 ${product.stock}`, tone: "muted" }
                  : null

    return (
        <Link href={detailHref} className={cn("group block h-full", className)}>
            <Card
                className={cn(
                    "relative flex h-full flex-col gap-0 overflow-hidden border p-0 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/20 group-focus-within:ring-2 group-focus-within:ring-ring"
                )}
            >
                {/* Cover: 4:3 aspect ratio — gives more breathing room to title/price below */}
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-xl bg-muted">
                    {product.image ? (
                        <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, (max-width: 1536px) 25vw, (max-width: 1600px) 20vw, 16vw"
                            className={cn(
                                "object-cover transition-all duration-300 group-hover:scale-105",
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
                    {stockChip && (
                        <span
                            className={cn(
                                "absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shadow-sm",
                                stockChip.tone === "urgent" &&
                                    "bg-destructive text-white animate-pulse text-[11px] font-semibold ring-1 ring-destructive/40",
                                stockChip.tone === "success" &&
                                    "bg-success/15 text-success ring-1 ring-success/30 backdrop-blur-sm",
                                stockChip.tone === "muted" &&
                                    "bg-background/80 text-muted-foreground ring-1 ring-border backdrop-blur-sm",
                            )}
                        >
                            {stockChip.tone === "urgent" && (
                                <span aria-hidden>⚡</span>
                            )}
                            {stockChip.label}
                        </span>
                    )}
                </div>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
                    {product.tags.length > 0 && (
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
                    )}
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight transition-colors group-hover:text-primary sm:text-base">
                        {product.name}
                    </h3>
                    {brief && (
                        <p className="line-clamp-2 hidden flex-1 text-xs text-muted-foreground sm:block">
                            {brief}
                            {briefRaw.length > 80 ? "…" : ""}
                        </p>
                    )}
                    {/* Price block — discount shows original (small, line-through) above
                        the discounted price (large, destructive) so the savings are obvious.
                        Standard price renders as a single inline line with "起" muted. */}
                    <div className="mt-auto pt-1">
                        {isFree ? (
                            <span className="text-lg font-bold tabular-nums text-primary">免费</span>
                        ) : !isSoldOut && hasDiscount ? (
                            <div className="flex flex-col leading-tight">
                                <span className="text-xs text-muted-foreground line-through">
                                    {displayPrice.label}
                                </span>
                                <span className="text-lg font-bold tabular-nums text-destructive">
                                    {discountedLabel}
                                </span>
                            </div>
                        ) : (
                            <span
                                className={cn(
                                    "text-lg font-bold tabular-nums",
                                    isSoldOut && "text-muted-foreground line-through",
                                )}
                            >
                                ¥{displayPrice.basePrice.toFixed(2)}
                                {displayPrice.suffix && (
                                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                        {displayPrice.suffix.trim()}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                    {/* CTA — only rendered when the action diverges from "open detail".
                        Default in-stock state: whole card is the link, no button (less
                        visual noise). Restockable sold-out: surface the bell button —
                        that's the action the buyer needs and isn't routed through detail. */}
                    {canRestock && (
                        <Button
                            size="sm"
                            className="w-full"
                            variant="default"
                        >
                            <Bell className="size-3.5" />
                            <span className="text-xs sm:text-sm">我要催货</span>
                        </Button>
                    )}
                </CardContent>
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
            <div className="aspect-[4/3] shrink-0 animate-pulse bg-muted" />
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="hidden h-3 w-1/2 animate-pulse rounded bg-muted sm:block" />
                <div className="mt-auto h-6 w-20 animate-pulse rounded bg-muted" />
            </div>
        </div>
    )
}
