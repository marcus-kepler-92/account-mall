import type { MetadataRoute } from "next"

function getBaseUrl(): string {
    return (
        process.env.BETTER_AUTH_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
    )
}

export default function robots(): MetadataRoute.Robots {
    const base = getBaseUrl()
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: "/admin/",
        },
        sitemap: `${base}/sitemap.xml`,
    }
}
