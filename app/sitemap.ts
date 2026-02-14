import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

function getBaseUrl(): string {
    return (
        process.env.BETTER_AUTH_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    )
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = getBaseUrl()

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
