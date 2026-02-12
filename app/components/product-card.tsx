"use client"

import Link from "next/link"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SoldOutOverlay } from "@/app/components/sold-out-overlay"

// Primary-based gradients for theme consistency
const CARD_GRADIENTS = [
    "from-primary/20 to-primary/40",
    "from-primary/15 to-primary/35",
    "from-primary/10 to-primary/30",
    "from-primary/25 to-primary/45",
    "from-primary/18 to-primary/38",
] as const

export type ProductCardData = {
    id: string
    name: string
    slug: string
    description: string | null
    image: string | null
    price: number
    stock: number
    tags: { id: string; name: string; slug: string }[]
}

type ProductCardProps = {
    product: ProductCardData
    gradientIndex?: number
    className?: string
}

/**
 * Product card with equal height in grid, cover maintains aspect ratio (1:1).
 */
export function ProductCard({ product, gradientIndex = 0, className }: ProductCardProps) {
    const gradient = CARD_GRADIENTS[gradientIndex % CARD_GRADIENTS.length]
    const description = product.description
        ? String(product.description).replace(/<[^>]+>/g, "").slice(0, 80)
        : ""
    const isSoldOut = product.stock === 0
    const productSlug = `${product.id}-${product.slug}`

    return (
        <Link href={`/products/${productSlug}`} className={cn("group block h-full", className)}>
            <Card
                className={cn(
                    "relative flex h-full flex-col overflow-hidden border p-0 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-primary/20 group-focus-within:ring-2 group-focus-within:ring-ring"
                )}
            >
                {/* Cover: 1:1 aspect ratio, image preserves ratio via object-cover */}
                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-t-xl bg-muted">
                    {product.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={product.image}
                            alt={product.name}
                            className={cn(
                                "size-full object-cover transition-all duration-300 group-hover:scale-105",
                                isSoldOut && "grayscale"
                            )}
                        />
                    ) : (
                        <div
                            className={cn(
                                "flex size-full items-center justify-center bg-gradient-to-br",
                                gradient
                            )}
                        >
                            <ImageIcon className="size-12 text-muted-foreground/50 transition-transform duration-300 group-hover:scale-110" />
                        </div>
                    )}
                    {isSoldOut && <SoldOutOverlay />}
                </div>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-1">
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
                    <h3 className="line-clamp-2 text-base font-semibold leading-tight transition-colors group-hover:text-primary">
                        {product.name}
                    </h3>
                    {description && (
                        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                            {description}
                            {description.length >= 80 ? "…" : ""}
                        </p>
                    )}
                </CardContent>

                <CardFooter className="shrink-0 border-t px-4 py-3">
                    <div className="flex w-full items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <span
                                className={cn(
                                    "text-lg font-bold tabular-nums",
                                    isSoldOut && "text-muted-foreground line-through"
                                )}
                            >
                                ¥{product.price.toFixed(2)}
                            </span>
                            {product.stock > 0 ? (
                                <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                    库存 {product.stock}
                                </span>
                            ) : (
                                <span className="ml-1.5 block text-[11px] text-muted-foreground">
                                    已售罄
                                </span>
                            )}
                        </div>
                        <Button size="sm" className="shrink-0" disabled={product.stock === 0}>
                            购买
                        </Button>
                    </div>
                </CardFooter>
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
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex shrink-0 items-center justify-between border-t p-4">
                <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                <div className="h-8 w-14 animate-pulse rounded bg-muted" />
            </div>
        </div>
    )
}
