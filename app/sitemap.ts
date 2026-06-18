import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/** Avoid prerender at build time (no DB in Docker build); generate on request. */
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = config.siteUrl

    const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
    })

    const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    // Google ignores lastmod values it deems unreliable — a per-request
    // `new Date()` makes every static page look "just updated" and discredits
    // the whole signal. The homepage reflects the catalog, so derive its
    // lastmod from the most recent product update; the rarely-changing static
    // pages omit lastmod entirely (preferable to a fabricated timestamp).
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
        {
            url: `${base}/privacy`,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        {
            url: `${base}/terms`,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        {
            url: `${base}/refund`,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        ...productUrls,
    ]
}
