import Link from "next/link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
import { Button } from "@/components/ui/button"
import { Plus, Package } from "lucide-react"
import { ProductsList } from "@/app/components/products-list"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { ProductStatusFilter } from "@/app/components/product-status-filter"

type SearchParams = Promise<{ status?: string; tag?: string }>

export default async function AdminProductsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const params = await searchParams
    const statusFilter = params.status
    const tagFilter = params.tag

    // Build where clause
    const where: Record<string, unknown> = {}
    if (statusFilter === "ACTIVE" || statusFilter === "INACTIVE") {
        where.status = statusFilter
    }
    if (tagFilter) {
        where.tags = { some: { slug: tagFilter } }
    }

    const [products, tags] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                tags: {
                    select: { id: true, name: true, slug: true },
                },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.tag.findMany({
            orderBy: { name: "asc" },
        }),
    ])

    // Get unsold card counts
    const productIds = products.map((p) => p.id)
    const stockCounts = await prisma.card.groupBy({
        by: ["productId"],
        where: {
            productId: { in: productIds },
            status: "UNSOLD",
        },
        _count: { id: true },
    })
    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]))

    // Serialize for Client Components: Decimal -> number, Map -> plain object
    const serializedProducts = products.map((p) => ({
        ...p,
        price: Number(p.price),
    }))
    const stockMapPlain = Object.fromEntries(stockMap)

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">商品管理</h2>
                    <p className="text-muted-foreground">
                        管理数字商品和价格
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/products/new">
                        <Plus className="size-4" />
                        添加商品
                    </Link>
                </Button>
            </div>

            {/* Filters */}
            <ProductStatusFilter
                currentStatus={statusFilter}
                currentTag={tagFilter}
                tags={tags.map((t) => ({ slug: t.slug, name: t.name }))}
            />

            {/* Product list (table on desktop, cards on mobile) */}
            {products.length > 0 ? (
                <ProductsList products={serializedProducts} stockMap={stockMapPlain} />
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <Package className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">暂无商品</CardTitle>
                        <CardDescription className="mb-6 text-center max-w-sm">
                            {statusFilter || tagFilter
                                ? "当前筛选条件下没有商品，请调整筛选条件。"
                                : "添加你的第一个数字商品开始吧。"}
                        </CardDescription>
                        {!statusFilter && !tagFilter && (
                            <Button asChild>
                                <Link href="/admin/products/new">
                                    <Plus className="size-4" />
                                    添加第一个商品
                                </Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
