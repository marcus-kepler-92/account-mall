import type { MetadataRoute } from "next"
import { config } from "@/lib/config"

export default function robots(): MetadataRoute.Robots {
    const base = config.siteUrl
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: "/admin/",
        },
        sitemap: `${base}/sitemap.xml`,
    }
}
