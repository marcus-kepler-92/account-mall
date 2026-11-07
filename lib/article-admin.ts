import { prisma } from "@/lib/prisma"
import { validationError } from "@/lib/api-response"

// Shared integrity checks for the admin article create / update handlers.
// Returns a 400 response (field-level, so the form can highlight the field)
// or null when the references are valid.
export async function checkArticleRefs(args: {
    slug?: string
    productIds?: string[]
    excludeId?: string
}) {
    if (args.slug !== undefined) {
        const taken = await prisma.article.findUnique({
            where: { slug: args.slug },
            select: { id: true },
        })
        if (taken && taken.id !== args.excludeId) {
            return validationError(
                { fieldErrors: { slug: ["这个网址已被其他文章使用"] } },
                "网址已被占用",
            )
        }
    }

    if (args.productIds && args.productIds.length > 0) {
        const unique = [...new Set(args.productIds)]
        const found = await prisma.product.count({ where: { id: { in: unique } } })
        if (found !== unique.length) {
            return validationError(
                { fieldErrors: { productIds: ["部分关联商品不存在"] } },
                "关联商品不存在",
            )
        }
    }

    return null
}

/** Admin list/detail include: related products for the form and the table. */
export const articleAdminInclude = {
    products: { select: { id: true, name: true, slug: true } },
} as const
