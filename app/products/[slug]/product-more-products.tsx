import Link from "next/link"
import { LayoutGrid } from "lucide-react"

export type MoreProductLink = { slug: string; name: string }

// Product → product internal links. Before this, a product page linked only to
// guides, so the homepage was the sole internal link to every product — and
// Search Console (2026-11-13) still listed 7 of 12 product pages as
// "discovered – not indexed", never crawled.
export function ProductMoreProducts({ products }: { products: MoreProductLink[] }) {
  if (products.length === 0) return null

  return (
    <section aria-labelledby="more-products-heading">
      <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <h2
          id="more-products-heading"
          className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
        >
          <LayoutGrid className="size-4" aria-hidden />
          其他地区与商品
        </h2>
        <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {products.map((p) => (
            <li key={p.slug}>
              <Link href={`/products/${p.slug}`} className="text-sm hover:underline">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
