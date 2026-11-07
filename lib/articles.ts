import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"

// Cached storefront reads for the public /guides section. unstable_cache
// JSON-serialises its results, so dates are returned as ISO strings.
// Invalidated by revalidateArticles() (admin article writes) and, for the
// related-product data, by product writes.

const ARTICLE_CACHE_TTL_SECONDS = 300
const RELATED_ARTICLES_LIMIT = 5

export type ArticleListItem = {
    slug: string
    title: string
    summary: string | null
    publishedAt: string | null
    updatedAt: string
}

export type ArticleRelatedProduct = {
    name: string
    slug: string
    summary: string | null
}

export type ArticleDetail = ArticleListItem & {
    seoTitle: string | null
    seoDescription: string | null
    content: string | null
    products: ArticleRelatedProduct[]
}

const listSelect = {
    slug: true,
    title: true,
    summary: true,
    publishedAt: true,
    updatedAt: true,
} as const

function toListItem(a: {
    slug: string
    title: string
    summary: string | null
    publishedAt: Date | null
    updatedAt: Date
}): ArticleListItem {
    return {
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        updatedAt: a.updatedAt.toISOString(),
    }
}

/** All published articles, newest first (the /guides index and the sitemap). */
export const getPublishedArticles = unstable_cache(
    async (): Promise<ArticleListItem[]> => {
        const rows = await prisma.article.findMany({
            where: { status: "PUBLISHED" },
            orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
            select: listSelect,
        })
        return rows.map(toListItem)
    },
    ["articles-published"],
    { revalidate: ARTICLE_CACHE_TTL_SECONDS, tags: ["articles"] },
)

/** One published article with its active related products; null if missing or a draft. */
export const getPublishedArticleBySlug = unstable_cache(
    async (slug: string): Promise<ArticleDetail | null> => {
        const a = await prisma.article.findFirst({
            where: { slug, status: "PUBLISHED" },
            select: {
                ...listSelect,
                seoTitle: true,
                seoDescription: true,
                content: true,
                products: {
                    where: { status: "ACTIVE" },
                    orderBy: { sortOrder: "asc" },
                    select: { name: true, slug: true, summary: true },
                },
            },
        })
        if (!a) return null
        return {
            ...toListItem(a),
            seoTitle: a.seoTitle,
            seoDescription: a.seoDescription,
            content: a.content,
            products: a.products,
        }
    },
    ["article-by-slug"],
    { revalidate: ARTICLE_CACHE_TTL_SECONDS, tags: ["articles", "products"] },
)

/** Published articles linked to a product, for the product page's "相关教程". */
export const getArticlesForProduct = unstable_cache(
    async (productId: string): Promise<ArticleListItem[]> => {
        const rows = await prisma.article.findMany({
            where: { status: "PUBLISHED", products: { some: { id: productId } } },
            orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
            take: RELATED_ARTICLES_LIMIT,
            select: listSelect,
        })
        return rows.map(toListItem)
    },
    ["articles-for-product"],
    { revalidate: ARTICLE_CACHE_TTL_SECONDS, tags: ["articles"] },
)

/** Display date for article pages, e.g. "2026年11月7日" (Hong Kong time). */
export function formatArticleDate(iso: string | null): string {
    if (!iso) return ""
    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Hong_Kong",
    }).format(new Date(iso))
}
