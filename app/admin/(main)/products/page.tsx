import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getAdminPermissions } from "@/lib/admin-permissions"
import { resolveInventorySubtype } from "@/lib/inventory"
import { computeManualDisplay } from "@/lib/manual-display"
import { formatCurrency } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductsTableWrapper } from "./products-table-wrapper"
import type { ProductRow } from "./products-columns"
import { PageHeader } from "@/app/admin/components"

// Sentinel for "unbounded stock" rows (AUTO_FETCH, MANUAL with inventoryTracked
// off). Keeps numeric sort order intact — these rows always sort to the end of
// ascending sort and the top of descending sort, which matches the intuition
// that unlimited > any finite count.
const UNLIMITED_STOCK = Number.MAX_SAFE_INTEGER

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
                // Needed by MANUAL row mapper: price band + tracked-stock sum
                // derive from active variants. Cheap join for an admin list.
                variants: {
                    select: { price: true, stockQuantity: true, isActive: true },
                },
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
        const cardStock = stockMap.get(p.id) ?? 0
        const subscriberCount = subMap.get(p.id) ?? 0
        const activeVariantCount = variantMap.get(p.id) ?? 0
        const isNormalActive = p.productType === "NORMAL" && p.status === "ACTIVE"
        const hasAlert =
            isNormalActive && resolveInventorySubtype(cardStock, subscriberCount) !== null

        // Price/stock display rules differ per productType:
        //   NORMAL     → product.price + UNSOLD-card count (existing behavior)
        //   AUTO_FETCH → product.price + 不限 (on-demand fetch, no inventory)
        //   MANUAL     → variant price band + (tracked: sum / untracked: 不限)
        const productPrice = Number(p.price)
        const manualDisplay = computeManualDisplay(p, p.variants)
        const activeVariants = p.variants.filter((v) => v.isActive)
        const variantStockSum = activeVariants.reduce(
            (acc, v) => acc + v.stockQuantity,
            0,
        )

        let price: number
        let priceLabel: string
        if (manualDisplay.isManual) {
            price = manualDisplay.priceMin ?? 0
            priceLabel = manualDisplay.priceLabel ?? "—"
        } else {
            price = productPrice
            priceLabel = formatCurrency(productPrice)
        }

        let stock: number
        let stockLabel: string
        if (p.productType === "AUTO_FETCH") {
            stock = UNLIMITED_STOCK
            stockLabel = "不限"
        } else if (manualDisplay.isManual) {
            if (p.inventoryTracked) {
                stock = variantStockSum
                stockLabel = String(variantStockSum)
            } else {
                stock = UNLIMITED_STOCK
                stockLabel = "不限"
            }
        } else {
            stock = cardStock
            stockLabel = String(cardStock)
        }

        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            status: p.status,
            productType: p.productType,
            price,
            priceLabel,
            tags: p.tags,
            stock,
            stockLabel,
            sales: salesMap.get(p.id) ?? 0,
            subscriberCount,
            hasAlert,
            activeVariantCount,
            costPerUnit: p.costPerUnit == null ? null : Number(p.costPerUnit),
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
