import { prisma } from "@/lib/prisma"
import type { ArticleProductOption } from "./article-form-products-card"

/** Product picker options for the article form: active products first. */
export async function getArticleProductOptions(): Promise<ArticleProductOption[]> {
    return prisma.product.findMany({
        orderBy: [{ status: "asc" }, { sortOrder: "desc" }, { name: "asc" }],
        select: { id: true, name: true, status: true },
    })
}
