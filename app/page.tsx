import type { Metadata } from "next"
import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { ProductCatalog } from "@/app/components/product-catalog"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"
import { AnnouncementsBlock } from "./announcements-block"
import { config } from "@/lib/config"
import {
  DEFAULT_SEO_TITLE,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_H1,
  DEFAULT_SEO_SUBTITLE,
} from "@/lib/seo-keywords"
import type { ProductCardData } from "@/app/components/product-card"

const PAGE_SIZE = 18
const ANNOUNCEMENTS_LIMIT = 20
const HOMEPAGE_CACHE_REVALIDATE_SECONDS = 300

export const metadata: Metadata = {
  title: DEFAULT_SEO_TITLE,
  description: DEFAULT_SEO_DESCRIPTION,
  openGraph: {
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    url: config.siteUrl,
  },
  alternates: { canonical: config.siteUrl },
}

const getCachedAnnouncements = unstable_cache(
  async () =>
    prisma.announcement.findMany({
      where: { status: "PUBLISHED", audience: { in: ["CUSTOMER", "ALL"] } },
      orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: ANNOUNCEMENTS_LIMIT,
    }),
  ["home-announcements"],
  { revalidate: HOMEPAGE_CACHE_REVALIDATE_SECONDS, tags: ["announcements"] },
)

const getCachedTags = unstable_cache(
  async () =>
    prisma.tag.findMany({
      include: {
        _count: { select: { products: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { name: "asc" },
    }),
  ["home-tags"],
  { revalidate: HOMEPAGE_CACHE_REVALIDATE_SECONDS, tags: ["tags", "products"] },
)

const getCachedProducts = unstable_cache(
  async (tagSlugs: string[]) => {
    const where = {
      status: "ACTIVE" as const,
      ...(tagSlugs.length > 0 && { tags: { some: { slug: { in: tagSlugs } } } }),
    }
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          summary: true,
          image: true,
          price: true,
          productType: true,
          tags: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ sortOrder: "asc" }],
        take: PAGE_SIZE,
      }),
      prisma.product.count({ where }),
    ])
    return { products, total }
  },
  ["home-products"],
  { revalidate: HOMEPAGE_CACHE_REVALIDATE_SECONDS, tags: ["products"] },
)

const getCachedStockCounts = unstable_cache(
  async (productIds: string[]) => {
    if (productIds.length === 0) return [] as { productId: string; _count: { id: number } }[]
    return prisma.card.groupBy({
      by: ["productId"],
      where: { status: "UNSOLD", productId: { in: productIds } },
      _count: { id: true },
    })
  },
  ["home-stock-counts"],
  { revalidate: 60, tags: ["cards", "products"] },
)

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string>>
}) {
    const params = await searchParams
    const tagParam = params.tag ?? ""
    const tagSlugs = tagParam
        ? tagParam.split(",").map(s => s.trim()).filter(Boolean).sort()
        : []

    const [announcements, tags, productsResult] = await Promise.all([
        getCachedAnnouncements(),
        getCachedTags(),
        getCachedProducts(tagSlugs),
    ])
    const { products, total } = productsResult

    const productIds = products.map(p => p.id)
    const stockCounts = await getCachedStockCounts(productIds)

    const stockMap = new Map(stockCounts.map(s => [s.productId, s._count.id]))
    const productsWithStock: ProductCardData[] = products.map(product => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        summary: product.summary ?? null,
        image: product.image,
        price: Number(product.price),
        productType: (product.productType ?? "NORMAL") as "NORMAL" | "AUTO_FETCH",
        stock: product.productType === "AUTO_FETCH" ? 1 : (stockMap.get(product.id) ?? 0),
        tags: product.tags,
    }))

    const initialData = {
        tags,
        products: {
            data: productsWithStock,
            meta: {
                totalPages: Math.ceil(total / PAGE_SIZE) || 1,
            },
        },
    }

    const frontAnnouncements = announcements.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        publishedAt: a.publishedAt?.toISOString() ?? null,
    }))

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            <main className="flex-1">
                <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8 xl:max-w-7xl 2xl:max-w-[90rem]">
                    <section className="mb-6 sm:mb-12 text-center">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">
                            {DEFAULT_SEO_H1}
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-base sm:text-lg text-muted-foreground">
                            {config.siteSubtitle || DEFAULT_SEO_SUBTITLE}
                        </p>
                    </section>
                    <AnnouncementsBlock announcements={frontAnnouncements} />
                    <ProductCatalog initialData={initialData} />
                </div>
            </main>

            <SiteFooter />
        </div>
    )
}
