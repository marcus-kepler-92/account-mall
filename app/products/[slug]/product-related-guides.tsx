import Link from "next/link"
import { BookOpen } from "lucide-react"
import type { ArticleListItem } from "@/lib/articles"

// Links from the product page to the guide articles that recommend it — the
// other half of the article ↔ product internal linking.
export function ProductRelatedGuides({ guides }: { guides: ArticleListItem[] }) {
  if (guides.length === 0) return null

  return (
    <section aria-labelledby="related-guides-heading">
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2
          id="related-guides-heading"
          className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
        >
          <BookOpen className="size-4" aria-hidden />
          相关教程
        </h2>
        <ul className="space-y-2">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guides/${g.slug}`} className="text-sm hover:underline">
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
