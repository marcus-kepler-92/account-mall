import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { config } from "@/lib/config"
import { buildArticleDescription, buildArticleTitle } from "@/lib/article-seo"
import {
  getPublishedArticleBySlug,
  getPublishedArticles,
  formatArticleDate,
} from "@/lib/articles"
import { SiteHeader } from "@/app/components/site-header"
import { SiteFooter } from "@/app/components/site-footer"
import { ServerMarkdown } from "@/app/components/server-markdown"
import { ArticleRelatedProducts } from "./article-related-products"
import { ArticleMoreGuides } from "./article-more-guides"

const MORE_GUIDES_LIMIT = 5
const shareImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "VoidLogins — Apple ID Store" }

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await getPublishedArticleBySlug(slug)
  if (!article) return { title: "使用教程", robots: { index: false } }

  const title = buildArticleTitle(article)
  const description = buildArticleDescription(article)
  const url = `${config.siteUrl}/guides/${article.slug}`
  // openGraph / twitter replace the root layout's objects wholesale, so the
  // shared fields and the share card are restated here.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | ${config.siteName}`,
      description,
      url,
      siteName: config.siteName,
      locale: "zh_CN",
      type: "article",
      ...(article.publishedAt && { publishedTime: article.publishedAt }),
      modifiedTime: article.updatedAt,
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${config.siteName}`,
      description,
      images: [shareImage],
    },
  }
}

export default async function GuideArticlePage({ params }: PageProps) {
  const { slug } = await params
  const [article, allArticles] = await Promise.all([
    getPublishedArticleBySlug(slug),
    getPublishedArticles(),
  ])
  if (!article) notFound()

  const url = `${config.siteUrl}/guides/${article.slug}`
  const moreGuides = allArticles.filter((a) => a.slug !== article.slug).slice(0, MORE_GUIDES_LIMIT)
  const showUpdated =
    article.publishedAt != null &&
    formatArticleDate(article.updatedAt) !== formatArticleDate(article.publishedAt)

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        description: buildArticleDescription(article),
        url,
        mainEntityOfPage: url,
        inLanguage: "zh-CN",
        ...(article.publishedAt && { datePublished: article.publishedAt }),
        dateModified: article.updatedAt,
        author: { "@id": `${config.siteUrl}/#organization` },
        publisher: { "@id": `${config.siteUrl}/#organization` },
        isPartOf: { "@id": `${config.siteUrl}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "首页", item: config.siteUrl },
          { "@type": "ListItem", position: 2, name: "使用教程", item: `${config.siteUrl}/guides` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
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
        <nav aria-label="面包屑" className="mb-4 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="shrink-0 hover:text-foreground">首页</Link>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
          <Link href="/guides" className="shrink-0 hover:text-foreground">使用教程</Link>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
          <span className="truncate text-foreground">{article.title}</span>
        </nav>

        <article>
          <header className="space-y-3">
            <h1 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">{article.title}</h1>
            <p className="text-sm text-muted-foreground">
              {config.siteName}
              {article.publishedAt && (
                <>
                  {" · 发布于 "}
                  <time dateTime={article.publishedAt}>{formatArticleDate(article.publishedAt)}</time>
                </>
              )}
              {showUpdated && (
                <>
                  {" · 更新于 "}
                  <time dateTime={article.updatedAt}>{formatArticleDate(article.updatedAt)}</time>
                </>
              )}
            </p>
            {article.summary && (
              <p className="text-base text-muted-foreground leading-relaxed">{article.summary}</p>
            )}
          </header>

          {article.content?.trim() && (
            <ServerMarkdown
              content={article.content}
              fallbackAlt={article.title}
              className="mt-8 sm:prose-base"
            />
          )}
        </article>

        <ArticleRelatedProducts products={article.products} />
        <ArticleMoreGuides articles={moreGuides} />
      </main>
      <SiteFooter />
    </div>
  )
}
