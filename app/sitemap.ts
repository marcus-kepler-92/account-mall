import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = config.siteUrl

    const products = await prisma.product.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, slug: true, updatedAt: true },
    })

    const productUrls: MetadataRoute.Sitemap = products.map((p) => ({
        url: `${base}/products/${p.id}-${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    return [
        {
            url: base,
            lastModified: new Date(),
            changeFrequency: "daily" as const,
            priority: 1,
        },
        ...productUrls,
    ]
}
