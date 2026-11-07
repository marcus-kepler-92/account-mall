import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ArticleForm, type ArticleFormData } from "../article-form"
import { getArticleProductOptions } from "../article-product-options"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ id: string }>
}

export default async function AdminEditArticlePage({ params }: PageProps) {
    const { id } = await params

    const [article, products] = await Promise.all([
        prisma.article.findUnique({
            where: { id },
            include: { products: { select: { id: true } } },
        }),
        getArticleProductOptions(),
    ])

    if (!article) {
        notFound()
    }

    const formData: ArticleFormData = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        summary: article.summary,
        content: article.content,
        status: article.status,
        productIds: article.products.map((p) => p.id),
    }

    return <ArticleForm article={formData} products={products} />
}
