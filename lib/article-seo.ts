import { descriptionToPlainText } from "@/lib/description"

// SERP / social title. `seoTitle` can lead with the searcher's wording while
// the on-page H1 (`title`) reads naturally. The root layout appends the site name.
export function buildArticleTitle(a: { seoTitle?: string | null; title: string }): string {
  return a.seoTitle?.trim() || a.title
}

// Meta + structured-data description: SEO override → summary → body text.
export function buildArticleDescription(a: {
  seoDescription?: string | null
  summary?: string | null
  content?: string | null
  title: string
}): string {
  const seo = a.seoDescription?.trim()
  if (seo) return seo.slice(0, 160)
  const summary = a.summary?.trim()
  if (summary) return summary.slice(0, 160)
  const body = descriptionToPlainText(a.content, 400).replace(/\s+/g, " ").trim().slice(0, 160)
  return body || a.title
}
