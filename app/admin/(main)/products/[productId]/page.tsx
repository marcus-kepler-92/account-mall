import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { ProductForm } from "@/app/components/product-form"
import { DeactivateProductButton } from "./product-actions"
import { CrossSellTargetsForm } from "./cross-sell-targets-form"
import { SkuListEditor } from "./variants/sku-list-editor"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ productId: string }>
}

export default async function AdminEditProductPage({ params }: PageProps) {
    const { productId } = await params

    const [product, tags, cardTemplates, crossSellTargets, otherProducts] = await Promise.all([
        prisma.product.findUnique({
            where: { id: productId },
            include: {
                tags: {
                    select: { id: true, name: true, slug: true },
                },
                cardTemplates: {
                    select: { id: true, name: true, template: true },
                },
            },
        }),
        prisma.tag.findMany({
            select: { id: true, name: true, slug: true },
            orderBy: { name: "asc" },
        }),
        prisma.cardTemplate.findMany({
            select: { id: true, name: true, template: true },
            orderBy: { sortOrder: "asc" },
        }),
        prisma.productCrossSell.findMany({
            where: { sourceProductId: productId },
            include: { target: { select: { id: true, name: true } } },
            orderBy: { sortOrder: "asc" },
        }),
        prisma.product.findMany({
            where: { status: "ACTIVE", NOT: { id: productId } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
    ])

    if (!product) {
        notFound()
    }

    const initialTargets = crossSellTargets.map((cs) => ({ id: cs.target.id, name: cs.target.name }))
    const isManual = product.productType === "MANUAL"

    return (
        <div className="space-y-6">
            <ProductForm
                product={{
                    ...product,
                    price: Number(product.price),
                    costPerUnit: product.costPerUnit != null ? Number(product.costPerUnit) : null,
                }}
                allTags={tags}
                allCardTemplates={cardTemplates}
                sourceUrlOptions={config.autoFetchSourceUrls}
            />

            {isManual && (
                <SkuListEditor mode="edit" productId={product.id} value={[]} />
            )}

            <CrossSellTargetsForm
                productId={productId}
                initialTargets={initialTargets}
                allProducts={otherProducts}
            />

            {/* Danger zone */}
            <div className="rounded-lg border border-destructive/20 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium">
                            {product.status === "ACTIVE"
                                ? "下架商品"
                                : "上架商品"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {product.status === "ACTIVE"
                                ? "将商品从前台移除"
                                : "将商品重新在前台展示"}
                        </p>
                    </div>
                    <DeactivateProductButton
                        productId={product.id}
                        currentStatus={product.status}
                    />
                </div>
            </div>
        </div>
    )
}
