import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductsDataTable } from "./products-data-table"
import type { ProductRow } from "./products-columns"
import { PageHeader } from "@/app/admin/components"

export const dynamic = "force-dynamic"

export default async function AdminProductsPage() {
    const [products, stockCounts] = await Promise.all([
        prisma.product.findMany({
            include: {
                tags: { select: { id: true, name: true, slug: true } },
            },
            orderBy: [
                { pinnedAt: { sort: "desc", nulls: "last" } },
                { createdAt: "desc" },
            ],
        }),
        prisma.card.groupBy({
            by: ["productId"],
            where: { status: "UNSOLD" },
            _count: { id: true },
        }),
    ])

    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]))

    const data: ProductRow[] = products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        productType: p.productType,
        price: Number(p.price),
        pinnedAt: p.pinnedAt?.toISOString() ?? null,
        tags: p.tags,
        stock: stockMap.get(p.id) ?? 0,
    }))

    return (
        <div className="space-y-6">
            <PageHeader title="商品管理" description="管理数字商品和价格">
                <Button asChild>
                    <Link href="/admin/products/new">
                        <Plus className="size-4" />
                        添加商品
                    </Link>
                </Button>
            </PageHeader>
            <ProductsDataTable data={data} />
        </div>
    )
}
