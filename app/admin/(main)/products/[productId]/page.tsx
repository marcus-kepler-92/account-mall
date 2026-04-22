import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { ProductForm } from "@/app/components/product-form"
import { DeactivateProductButton } from "./product-actions"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ productId: string }>
}

export default async function AdminEditProductPage({ params }: PageProps) {
    const { productId } = await params

    const [product, tags, cardTemplates] = await Promise.all([
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
    ])

    if (!product) {
        notFound()
    }

    return (
        <div className="space-y-6">
            <ProductForm
                product={{
                    ...product,
                    price: Number(product.price),
                }}
                allTags={tags}
                allCardTemplates={cardTemplates}
                sourceUrlOptions={config.autoFetchSourceUrls}
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
