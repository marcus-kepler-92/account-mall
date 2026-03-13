import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Zap } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { ProductCatalog } from "@/app/components/product-catalog"
import { ProductCardSkeleton } from "@/app/components/product-card"
import { SiteHeader } from "@/app/components/site-header"
import { AnnouncementsBlock } from "./announcements-block"
import { config } from "@/lib/config"
import { DEFAULT_SEO_TITLE, DEFAULT_SEO_DESCRIPTION, KEYWORDS_META } from "@/lib/seo-keywords"

function ProductCatalogSkeleton() {
    return (
        <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1600px]:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
            ))}
        </div>
    )
}

const ANNOUNCEMENTS_LIMIT = 20

/** 首页需每次请求拉取最新公告与数据，避免生产环境静态化后公告不更新 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: DEFAULT_SEO_TITLE,
  description: DEFAULT_SEO_DESCRIPTION,
  keywords: KEYWORDS_META.split(/[,，]/).map((k) => k.trim()).filter(Boolean),
  openGraph: {
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    url: config.siteUrl,
  },
  alternates: { canonical: config.siteUrl },
}

export default async function HomePage() {
    const announcements = await prisma.announcement.findMany({
        where: { status: "PUBLISHED" },
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        take: ANNOUNCEMENTS_LIMIT,
    })

    const frontAnnouncements = announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        publishedAt: a.publishedAt?.toISOString() ?? null,
    }))

    return (
        <div className="flex min-h-screen flex-col">
            <SiteHeader />

            {/* Main content */}
            <main className="flex-1">
                <div className="mx-auto max-w-6xl px-4 py-8 xl:max-w-7xl 2xl:max-w-[90rem]">
                    {/* Hero */}
                    <section className="mb-12 text-center">
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            {config.siteTagline}
                        </h1>
                        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
                            {config.siteSubtitle}
                        </p>
                    </section>
                    <AnnouncementsBlock announcements={frontAnnouncements} />
                    <Suspense fallback={<ProductCatalogSkeleton />}>
                        <ProductCatalog />
                    </Suspense>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t">
                <div className="mx-auto max-w-6xl px-4 py-8">
                    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                        <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-start">
                            <div className="flex items-center gap-2">
                                <div className="flex size-6 items-center justify-center rounded-md bg-primary">
                                    <Zap className="size-3 text-primary-foreground" />
                                </div>
                                <span className="text-sm font-medium">{config.siteName}</span>
                            </div>
                            <nav className="flex gap-4 text-sm text-muted-foreground">
                                <Link href="/orders/lookup" className="hover:text-foreground transition-colors">
                                    订单查询
                                </Link>
                            </nav>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            &copy; {new Date().getFullYear()} {config.siteName} 版权所有
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
