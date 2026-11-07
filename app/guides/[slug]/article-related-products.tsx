import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { ArticleRelatedProduct } from "@/lib/articles"

export function ArticleRelatedProducts({ products }: { products: ArticleRelatedProduct[] }) {
  if (products.length === 0) return null

  return (
    <section aria-labelledby="related-products-heading" className="mt-12">
      <h2 id="related-products-heading" className="text-lg font-semibold">
        文中提到的商品
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/products/${p.slug}`}
              className="group flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span className="font-medium leading-snug group-hover:underline">{p.name}</span>
              {p.summary && (
                <span className="mt-1 text-sm text-muted-foreground line-clamp-2">{p.summary}</span>
              )}
              <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-primary">
                查看商品
                <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
