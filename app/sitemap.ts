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

    const now = new Date()
    return [
        {
            url: base,
            lastModified: now,
            changeFrequency: "daily" as const,
            priority: 1,
        },
        {
            url: `${base}/orders/lookup`,
            lastModified: now,
            changeFrequency: "weekly" as const,
            priority: 0.5,
        },
        {
            url: `${base}/privacy`,
            lastModified: now,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        {
            url: `${base}/terms`,
            lastModified: now,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        {
            url: `${base}/refund`,
            lastModified: now,
            changeFrequency: "yearly" as const,
            priority: 0.3,
        },
        ...productUrls,
    ]
}
