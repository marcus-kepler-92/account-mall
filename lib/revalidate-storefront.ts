import { revalidateTag } from "next/cache"

/**
 * Cache tag invalidation helpers for the storefront's `unstable_cache` entries.
 *
 * Storefront tag map (see app/page.tsx, app/products/[productIdSlug]/page.tsx):
 * - "products"      — product list + product detail + stock counts
 * - "tags"          — catalog tag filter list
 * - "announcements" — homepage announcements
 * - "cards"         — stock counts only
 */

export function revalidateProducts(): void {
  revalidateTag("products", "max")
}

export function revalidateAnnouncements(): void {
  revalidateTag("announcements", "max")
}

export function revalidateTags(): void {
  revalidateTag("tags", "max")
  revalidateTag("products", "max")
}

export function revalidateCards(): void {
  revalidateTag("cards", "max")
}
