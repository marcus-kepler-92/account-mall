import Link from "next/link"
import type { ArticleListItem } from "@/lib/articles"

export function ArticleMoreGuides({ articles }: { articles: ArticleListItem[] }) {
  if (articles.length === 0) return null

  return (
    <section aria-labelledby="more-guides-heading" className="mt-12 border-t pt-8">
      <h2 id="more-guides-heading" className="text-lg font-semibold">
        更多教程
      </h2>
      <ul className="mt-3 space-y-2">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link href={`/guides/${a.slug}`} className="text-sm hover:underline">
              {a.title}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/guides" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        查看全部教程 →
      </Link>
    </section>
  )
}
