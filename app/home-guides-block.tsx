import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import type { ArticleListItem } from "@/lib/articles"

// Homepage → guide links. The homepage is the site's strongest page, yet it
// only linked to the /guides index; each article was two clicks deep.
export function HomeGuidesBlock({ guides }: { guides: ArticleListItem[] }) {
  if (guides.length === 0) return null

  return (
    <section aria-labelledby="home-guides-heading" className="mt-10 sm:mt-14">
      <div className="flex items-end justify-between gap-3">
        <h2
          id="home-guides-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl"
        >
          <BookOpen className="size-5" aria-hidden />
          Apple ID 使用教程
        </h2>
        <Link
          href="/guides"
          className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          全部教程
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="group block h-full rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <h3 className="font-medium leading-snug group-hover:underline">{g.title}</h3>
              {g.summary && (
                <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{g.summary}</p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
