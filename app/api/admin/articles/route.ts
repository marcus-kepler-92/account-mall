import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { createArticleSchema } from "@/lib/validations/article"
import { checkArticleRefs, articleAdminInclude } from "@/lib/article-admin"
import { revalidateArticles } from "@/lib/revalidate-storefront"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"

/**
 * GET /api/admin/articles
 * Admin only: list all articles (drafts included) with related products
 */
export async function GET() {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const articles = await prisma.article.findMany({
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        include: articleAdminInclude,
    })

    return NextResponse.json(articles)
}

/**
 * POST /api/admin/articles
 * Admin only: create an article
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createArticleSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { title, slug, seoTitle, seoDescription, summary, content, status, productIds } =
        parsed.data

    const refError = await checkArticleRefs({ slug, productIds })
    if (refError) return refError

    const isPublished = status === "PUBLISHED"
    const article = await prisma.article.create({
        data: {
            title,
            slug,
            seoTitle: seoTitle ?? null,
            seoDescription: seoDescription ?? null,
            summary: summary ?? null,
            content: content ?? null,
            status: status ?? "DRAFT",
            publishedAt: isPublished ? new Date() : null,
            products: { connect: [...new Set(productIds ?? [])].map((id) => ({ id })) },
        },
        include: articleAdminInclude,
    })

    revalidateArticles()
    return NextResponse.json(article, { status: 201 })
}

export const runtime = "nodejs"
