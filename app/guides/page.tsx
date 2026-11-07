import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { config } from "@/lib/config"
import { getPublishedArticles, formatArticleDate } from "@/lib/articles"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"

// Render per request (data is cached via unstable_cache) — a build-time
// prerender would need the database, which the Docker build doesn't have.
export const dynamic = "force-dynamic"

const title = "Apple ID 使用教程与常见问题"
const description =
  "外区Apple ID怎么选、登录App Store会不会锁机、礼品卡怎么充值、小火箭怎么下载……空域账号商城整理的苹果账号使用教程与常见问题解答。"
const url = `${config.siteUrl}/guides`
// openGraph replaces the root layout's object wholesale, so restate the
// file-based share card (same as /orders/lookup).
const shareImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "VoidLogins — Apple ID Store" }

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: {
    title: `${title} | ${config.siteName}`,
    description,
    url,
    siteName: config.siteName,
    locale: "zh_CN",
    type: "website",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | ${config.siteName}`,
    description,
    images: [shareImage],
  },
}

export default async function GuidesIndexPage() {
  const articles = await getPublishedArticles()

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        name: title,
        description,
        url,
        isPartOf: { "@id": `${config.siteUrl}/#website` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: articles.map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${config.siteUrl}/guides/${a.slug}`,
            name: a.title,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: config.siteUrl },
          { "@type": "ListItem", position: 2, name: "使用教程", item: url },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
        <nav aria-label="面包屑" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">首页</Link>
          <ChevronRight className="size-4" aria-hidden />
          <span className="text-foreground">使用教程</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-3 text-muted-foreground">
          选哪个地区、怎么安全登录、怎么充值和下载应用，买之前和用的时候常遇到的问题都在这里。
        </p>

        {articles.length === 0 ? (
          <p className="mt-10 text-muted-foreground">教程整理中，敬请期待。</p>
        ) : (
          <ul className="mt-8 divide-y rounded-xl border bg-card">
            {articles.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/guides/${a.slug}`}
                  className="group block p-4 sm:p-5 transition-colors hover:bg-muted/50"
                >
                  <h2 className="font-semibold leading-snug group-hover:underline">{a.title}</h2>
                  {a.summary && (
                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{a.summary}</p>
                  )}
                  {a.publishedAt && (
                    <time dateTime={a.publishedAt} className="mt-2 block text-xs text-muted-foreground">
                      {formatArticleDate(a.publishedAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
