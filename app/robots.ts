import type { MetadataRoute } from "next"
import { config } from "@/lib/config"

export default function robots(): MetadataRoute.Robots {
    const base = config.siteUrl
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // Order detail pages carry a noindex meta tag instead of a robots
            // disallow, so Google must stay able to crawl /orders/* to see it.
            // The trees below have no organic value, so block crawling outright.
            disallow: ["/admin/", "/distributor/", "/api/"],
        },
        sitemap: `${base}/sitemap.xml`,
    }
}
