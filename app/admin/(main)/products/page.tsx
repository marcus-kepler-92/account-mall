import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { resolveInventorySubtype } from "@/lib/inventory"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductsTableWrapper } from "./products-table-wrapper"
import type { ProductRow } from "./products-columns"
import { PageHeader } from "@/app/admin/components"

export const dynamic = "force-dynamic"

export default async function AdminProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ notice?: string }>
}) {
    const params = await searchParams
    const perms = await getAdminPermissions()
    const isSuperAdmin = perms?.isSuperAdmin ?? false

    const [products, stockCounts, salesCounts, subCounts, activeVariantCounts] = await Promise.all([
        prisma.product.findMany({
            include: {
                tags: { select: { id: true, name: true, slug: true } },
            },
            orderBy: [{ sortOrder: "asc" }],
        }),
        prisma.card.groupBy({
            by: ["productId"],
            where: { status: "UNSOLD" },
            _count: { id: true },
        }),
        prisma.order.groupBy({
            by: ["productId"],
            where: { status: "COMPLETED" },
            _sum: { quantity: true },
        }),
        prisma.restockSubscription.groupBy({
            by: ["productId"],
            where: { status: "PENDING" },
            _count: { id: true },
        }),
        // Active variant count per product (only matters for MANUAL but
        // grouping unconditionally is cheap and keeps the loader symmetric).
        prisma.productVariant.groupBy({
            by: ["productId"],
            where: { isActive: true },
            _count: { id: true },
        }),
    ])

    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]))
    const salesMap = new Map(salesCounts.map((s) => [s.productId, s._sum.quantity ?? 0]))
    const subMap = new Map(subCounts.map((s) => [s.productId, s._count.id]))
    const variantMap = new Map(activeVariantCounts.map((v) => [v.productId, v._count.id]))

    const data: ProductRow[] = products.map((p) => {
        const stock = stockMap.get(p.id) ?? 0
        const subscriberCount = subMap.get(p.id) ?? 0
        const activeVariantCount = variantMap.get(p.id) ?? 0
        const isNormalActive = p.productType === "NORMAL" && p.status === "ACTIVE"
        const hasAlert = isNormalActive && resolveInventorySubtype(stock, subscriberCount) !== null
        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            productType: p.productType,
            price: Number(p.price),
            tags: p.tags,
            stock,
            sales: salesMap.get(p.id) ?? 0,
            subscriberCount,
            hasAlert,
            activeVariantCount,
        }
    })

    const defaultFilters = params.notice === "inventory" ? { hasAlert: true } : undefined

    return (
        <div className="space-y-6">
            <PageHeader title="商品管理" description="管理数字商品和价格">
                {isSuperAdmin && (
                    <Button asChild size="sm">
                        <Link href="/admin/products/new">
                            <Plus className="size-4" />
                            添加商品
                        </Link>
                    </Button>
                )}
            </PageHeader>
            <ProductsTableWrapper data={data} isSuperAdmin={isSuperAdmin} defaultFilters={defaultFilters} />
        </div>
    )
}
