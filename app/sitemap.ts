import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { getPublishedArticles } from "@/lib/articles"

/** Avoid prerender at build time (no DB in Docker build); generate on request. */
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = config.siteUrl

    const [products, articles] = await Promise.all([
        prisma.product.findMany({
            where: { status: "ACTIVE" },
            select: { slug: true, updatedAt: true },
        }),
        getPublishedArticles(),
    ])

    const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    const articleUrls: MetadataRoute.Sitemap = articles.map((a) => ({
        url: `${base}/guides/${a.slug}`,
        lastModified: new Date(a.updatedAt),
        changeFrequency: "monthly" as const,
        priority: 0.6,
    }))
    // The /guides index changes when an article is published or edited.
    const latestArticleUpdate = articles.reduce<string | undefined>(
        (latest, a) => (!latest || a.updatedAt > latest ? a.updatedAt : latest),
        undefined,
    )

    // Google ignores lastmod values it deems unreliable — a per-request
    // `new Date()` makes every static page look "just updated" and discredits
    // the whole signal. The homepage reflects the catalog, so derive its
    // lastmod from the most recent product update; the rarely-changing static
    // pages omit lastmod entirely (preferable to a fabricated timestamp).
    // /privacy, /terms and /refund are noindex, so they stay out of the
    // sitemap — listing a noindex URL sends Search Console a contradiction.
    const latestProductUpdate = products.reduce<Date | undefined>(
        (latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest),
        undefined,
    )

    return [
        {
            url: base,
            ...(latestProductUpdate && { lastModified: latestProductUpdate }),
            changeFrequency: "daily" as const,
            priority: 1,
        },
        {
            url: `${base}/orders/lookup`,
            changeFrequency: "weekly" as const,
            priority: 0.5,
        },
        ...productUrls,
        ...(articles.length > 0
            ? [
                  {
                      url: `${base}/guides`,
                      ...(latestArticleUpdate && { lastModified: new Date(latestArticleUpdate) }),
                      changeFrequency: "weekly" as const,
                      priority: 0.7,
                  },
                  ...articleUrls,
              ]
            : []),
    ]
}
