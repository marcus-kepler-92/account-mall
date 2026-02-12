import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"
import { ProductOrderForm } from "@/app/components/product-order-form"
import { SoldOutOverlay } from "@/app/components/sold-out-overlay"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ productIdSlug: string }>
}

function parseProductIdSlug(segment: string): { productId: string; slug: string } | null {
    const idx = segment.indexOf("-")
    if (idx <= 0 || idx === segment.length - 1) return null
    return {
        productId: segment.slice(0, idx),
        slug: segment.slice(idx + 1),
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { productIdSlug } = await params
    const parsed = parseProductIdSlug(productIdSlug)
    if (!parsed) return { title: "商品" }

    const product = await prisma.product.findUnique({
        where: { id: parsed.productId },
        select: { name: true, description: true, price: true, status: true },
    })
    if (!product || product.status !== "ACTIVE") return { title: "商品" }

    const desc = product.description
        ? String(product.description).replace(/<[^>]+>/g, "").slice(0, 160)
        : `${product.name} - ¥${Number(product.price).toFixed(2)}`
    return {
        title: `${product.name} - Account Mall`,
        description: desc,
    }
}

export default async function ProductDetailPage({ params }: PageProps) {
    const { productIdSlug } = await params

    const parsed = parseProductIdSlug(productIdSlug)
    if (!parsed) notFound()

    const { productId, slug } = parsed

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            tags: { select: { id: true, name: true, slug: true } },
        },
    })

    if (!product || product.status !== "ACTIVE") {
        notFound()
    }

    // Redirect to canonical URL if slug mismatch
    if (product.slug !== slug) {
        redirect(`/products/${product.id}-${product.slug}`)
    }

    const productWithImage = product as typeof product & { image: string | null }

    const stockCount = await prisma.card.count({
        where: { productId: product.id, status: "UNSOLD" },
    })

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 2xl:max-w-7xl">
                    <Link href="/" className="flex items-center gap-2">
                        <div className="size-8 flex items-center justify-center rounded-lg bg-primary">
                            <Zap className="size-4 text-primary-foreground" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">Account Mall</span>
                    </Link>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/">返回首页</Link>
                    </Button>
                </div>
            </header>

            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 2xl:max-w-7xl">
                <div
                    className={
                        productWithImage.image || product.description
                            ? "grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12"
                            : "space-y-6"
                    }
                >
                    {/* Left: image + description */}
                    <div className="flex min-w-0 flex-col space-y-6 lg:sticky lg:top-24 lg:self-start">
                        {productWithImage.image && (
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted lg:aspect-square">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={productWithImage.image}
                                    alt={product.name}
                                    className={`size-full object-cover object-center ${stockCount === 0 ? "grayscale" : ""}`}
                                />
                                {stockCount === 0 && (
                                    <SoldOutOverlay badgePosition="right-3 top-3" />
                                )}
                            </div>
                        )}
                        {product.description && (
                            <div>
                                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                                    商品详情
                                </h2>
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4"
                                    dangerouslySetInnerHTML={{ __html: product.description }}
                                />
                            </div>
                        )}
                    </div>
                    {/* Right: tags, name, price, order form */}
                    <div className="flex min-w-0 flex-col space-y-6">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-1.5">
                                {product.tags.map((tag) => (
                                    <Badge key={tag.id} variant="secondary" className="text-xs font-normal">
                                        {tag.name}
                                    </Badge>
                                ))}
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{product.name}</h1>
                            <div className="flex items-center gap-3 text-lg">
                                <span
                                    className={
                                        stockCount === 0
                                            ? "font-bold text-muted-foreground line-through"
                                            : "font-bold"
                                    }
                                >
                                    ¥{Number(product.price).toFixed(2)}
                                </span>
                                {stockCount > 0 ? (
                                    <span className="text-sm text-muted-foreground">
                                        {stockCount} 件有货
                                    </span>
                                ) : (
                                    <span className="text-sm text-muted-foreground">已售罄</span>
                                )}
                            </div>
                        </div>
                        <ProductOrderForm
                            productId={product.id}
                            maxQuantity={product.maxQuantity}
                            price={Number(product.price)}
                            inStock={stockCount > 0}
                        />
                    </div>
                </div>
            </main>
        </div>
    )
}
