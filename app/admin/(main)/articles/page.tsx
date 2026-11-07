import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/app/admin/components"
import { ArticlesDataTable } from "./articles-data-table"
import type { ArticleRow } from "./articles-columns"

export const dynamic = "force-dynamic"

export default async function AdminArticlesPage() {
    const articles = await prisma.article.findMany({
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            publishedAt: true,
            updatedAt: true,
            _count: { select: { products: true } },
        },
    })

    const data: ArticleRow[] = articles.map((a) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        status: a.status,
        productCount: a._count.products,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        updatedAt: a.updatedAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="教程文章"
                description="公开的教程与常见问题，展示在 /guides，用于承接搜索流量并导向商品"
            >
                <Button asChild size="sm">
                    <Link href="/admin/articles/new">
                        <Plus className="size-4" />
                        新建文章
                    </Link>
                </Button>
            </PageHeader>
            <ArticlesDataTable data={data} />
        </div>
    )
}
