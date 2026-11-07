import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { updateArticleSchema } from "@/lib/validations/article"
import { checkArticleRefs, articleAdminInclude } from "@/lib/article-admin"
import { revalidateArticles } from "@/lib/revalidate-storefront"
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/articles/[id]
 * Admin only: single article for editing
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params
    const article = await prisma.article.findUnique({
        where: { id },
        include: articleAdminInclude,
    })
    if (!article) {
        return notFound("Article not found")
    }

    return NextResponse.json(article)
}

/**
 * PATCH /api/admin/articles/[id]
 * Admin only: update an article. `productIds`, when present, replaces the
 * related-product set.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateArticleSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const existing = await prisma.article.findUnique({
        where: { id },
        select: { id: true, status: true },
    })
    if (!existing) {
        return notFound("Article not found")
    }

    const { title, slug, seoTitle, seoDescription, summary, content, status, productIds } =
        parsed.data

    const refError = await checkArticleRefs({ slug, productIds, excludeId: id })
    if (refError) return refError

    const data: Prisma.ArticleUpdateInput = {}
    if (title !== undefined) data.title = title
    if (slug !== undefined) data.slug = slug
    if (seoTitle !== undefined) data.seoTitle = seoTitle
    if (seoDescription !== undefined) data.seoDescription = seoDescription
    if (summary !== undefined) data.summary = summary
    if (content !== undefined) data.content = content
    if (status !== undefined) data.status = status
    if (productIds !== undefined) {
        data.products = { set: [...new Set(productIds)].map((pid) => ({ id: pid })) }
    }

    // Keep the original publish date across edits — it is the article's
    // datePublished in structured data. Unpublishing clears it.
    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        data.publishedAt = new Date()
    } else if (status === "DRAFT") {
        data.publishedAt = null
    }

    const article = await prisma.article.update({
        where: { id },
        data,
        include: articleAdminInclude,
    })

    revalidateArticles()
    return NextResponse.json(article)
}

/**
 * DELETE /api/admin/articles/[id]
 * Admin only: delete an article
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params
    const existing = await prisma.article.findUnique({
        where: { id },
        select: { id: true },
    })
    if (!existing) {
        return notFound("Article not found")
    }

    await prisma.article.delete({ where: { id } })

    revalidateArticles()
    return NextResponse.json({ message: "Article deleted" })
}

export const runtime = "nodejs"
