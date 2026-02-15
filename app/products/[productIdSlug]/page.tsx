import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { ProductOrderForm } from "@/app/components/product-order-form"
import { SiteHeader } from "@/app/components/site-header"
import { SoldOutOverlay } from "@/app/components/sold-out-overlay"
import { RestockReminderForm } from "@/app/components/restock-reminder-form"
import { ProductBottomBar } from "../../components/product-bottom-bar"

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
        select: { name: true, description: true, price: true, status: true, image: true, id: true, slug: true },
    })
    if (!product || product.status !== "ACTIVE") return { title: "商品" }

    const desc = product.description
        ? String(product.description).replace(/<[^>]+>/g, "").slice(0, 160)
        : `${product.name} - ¥${Number(product.price).toFixed(2)}`
    const productUrl = `${config.siteUrl}/products/${product.id}-${product.slug}`
    const title = `${product.name} - ${config.siteName}`
    const ogImages = product.image ? [{ url: product.image }] : undefined
    return {
        title,
        description: desc,
        alternates: { canonical: productUrl },
        openGraph: {
            title,
            description: desc,
            url: productUrl,
            siteName: config.siteName,
            type: "website",
            ...(ogImages && { images: ogImages }),
        },
        twitter: {
            card: "summary_large_image",
            title,
            description: desc,
            ...(ogImages && { images: ogImages }),
        },
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

    const isSoldOut = stockCount === 0
    const priceNumber = Number(product.price)

    const productUrl = `${config.siteUrl}/products/${product.id}-${product.slug}`
    const descriptionPlain = product.description
        ? String(product.description).replace(/<[^>]+>/g, "").slice(0, 160)
        : `${product.name} - ¥${priceNumber.toFixed(2)}`
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: descriptionPlain,
        url: productUrl,
        ...(productWithImage.image && { image: productWithImage.image }),
        offers: {
            "@type": "Offer",
            price: priceNumber,
            priceCurrency: "CNY",
            availability: isSoldOut
                ? "https://schema.org/OutOfStock"
                : "https://schema.org/InStock",
        },
    }

    return (
        <div className="min-h-screen flex flex-col">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <SiteHeader />

            <main className="flex-1 mx-auto w-full max-w-6xl px-4 pb-24 pt-4 2xl:max-w-7xl lg:pb-10 lg:pt-8">
                <div
                    className={cn(
                        "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-10",
                        !productWithImage.image && !product.description && "space-y-6 lg:block"
                    )}
                >
                    {/* Left: media + description (mobile: 顶部媒体 + 详情) */}
                    <div className="flex min-w-0 flex-col space-y-4 lg:space-y-6">
                        <ProductMediaSection
                            image={productWithImage.image}
                            name={product.name}
                            isSoldOut={isSoldOut}
                        />
                        {product.description && (
                            <ProductDetailDescriptionSection description={product.description} />
                        )}
                    </div>

                    {/* Right: info + meta + order + restock（PC 侧栏卡片，移动端纵向） */}
                    <div className="mt-4 flex min-w-0 flex-col space-y-4 lg:mt-0 lg:space-y-4 lg:sticky lg:top-24 lg:self-start">
                        <ProductInfoSection
                            name={product.name}
                            tags={product.tags}
                            price={priceNumber}
                            stockCount={stockCount}
                            isSoldOut={isSoldOut}
                        />

                        <ProductMetaNoticeSection />

                        <section id="order-section">
                            <ProductOrderForm
                                productId={product.id}
                                productName={product.name}
                                maxQuantity={product.maxQuantity}
                                price={priceNumber}
                                inStock={!isSoldOut}
                                formId="product-order-form"
                            />
                        </section>

                        {isSoldOut && (
                            <Suspense fallback={null}>
                                <ProductRestockSection
                                    productId={product.id}
                                    productName={product.name}
                                />
                            </Suspense>
                        )}
                    </div>
                </div>
            </main>

            <ProductBottomBar
                price={priceNumber}
                inStock={!isSoldOut}
                orderSectionId="order-section"
                restockSectionId={isSoldOut ? "restock-section" : undefined}
                formId="product-order-form"
            />
        </div>
    )
}

type ProductMediaSectionProps = {
    image: string | null
    name: string
    isSoldOut: boolean
}

/** Only paths like /... are optimized by next/image; data: or external URLs use img. */
function isOptimizableImage(src: string): boolean {
    return src.startsWith("/")
}

function ProductMediaSection({ image, name, isSoldOut }: ProductMediaSectionProps) {
    if (!image) return null

    return (
        <section aria-label="商品图片">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted lg:aspect-square">
                {isOptimizableImage(image) ? (
                    <Image
                        src={image}
                        alt={name}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className={cn("object-cover object-center", isSoldOut && "grayscale")}
                        priority
                    />
                ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={image}
                        alt={name}
                        loading="eager"
                        fetchPriority="high"
                        className={cn("size-full object-cover object-center", isSoldOut && "grayscale")}
                    />
                )}
                {isSoldOut && <SoldOutOverlay badgePosition="right-3 top-3" />}
            </div>
        </section>
    )
}

type ProductInfoSectionProps = {
    name: string
    tags: { id: string; name: string; slug: string }[]
    price: number
    stockCount: number
    isSoldOut: boolean
}

function ProductInfoSection({ name, tags, price, stockCount, isSoldOut }: ProductInfoSectionProps) {
    return (
        <section
            aria-labelledby="product-info-heading"
            className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
        >
            <div className="space-y-3">
                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="secondary"
                                className="text-[11px] font-normal opacity-80"
                            >
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                )}
                <h1
                    id="product-info-heading"
                    className="text-xl font-bold leading-snug tracking-tight lg:text-2xl"
                >
                    {name}
                </h1>
                <div className="flex items-end justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                        <span
                            className={cn(
                                "text-2xl font-bold tabular-nums lg:text-3xl",
                                isSoldOut && "text-muted-foreground line-through"
                            )}
                        >
                            ¥{price.toFixed(2)}
                        </span>
                        {isSoldOut ? (
                            <Badge variant="outline" className="text-xs font-normal">
                                已售罄
                            </Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                库存 {stockCount} 件
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

function ProductMetaNoticeSection() {
    return (
        <section className="rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground sm:p-3.5">
            <div className="space-y-1.5">
                <p>虚拟商品自动发货，购买后可通过邮箱接收卡密信息。</p>
                <p>下单前请仔细阅读商品说明，确认无误后再提交订单。</p>
            </div>
        </section>
    )
}

type ProductDetailDescriptionSectionProps = {
    description: string
}

function ProductDetailDescriptionSection({ description }: ProductDetailDescriptionSectionProps) {
    return (
        <section aria-label="商品详情">
            <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">商品详情</h2>
                <div
                    className="prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: description }}
                />
            </div>
        </section>
    )
}

type ProductRestockSectionProps = {
    productId: string
    productName: string
}

function ProductRestockSection({ productId, productName }: ProductRestockSectionProps) {
    return (
        <section id="restock-section" aria-label="补货提醒">
            <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
                <RestockReminderForm productId={productId} productName={productName} />
            </div>
        </section>
    )
}

