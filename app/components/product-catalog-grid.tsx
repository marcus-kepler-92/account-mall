"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Package } from "lucide-react"
import { ProductCard, ProductCardSkeleton, type ProductCardData } from "@/app/components/product-card"

type Props = {
    products: ProductCardData[]
    loading: boolean
    error: string | null
    currentPage: number
    totalPages: number
    codeParam: string
    onPageChange: (page: number) => void
    onRetry: () => void
}

export function ProductCatalogGrid({
    products,
    loading,
    error,
    currentPage,
    totalPages,
    codeParam,
    onPageChange,
    onRetry,
}: Props) {
    const gridClass =
        "grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1600px]:grid-cols-6"

    if (loading) {
        return (
            <div className={gridClass}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <p className="text-sm font-medium text-destructive">{error}</p>
                <Button variant="outline" className="mt-4" onClick={onRetry}>
                    重试
                </Button>
            </div>
        )
    }

    if (products.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 rounded-full bg-muted p-4">
                    <Package className="size-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">未找到商品</p>
                <p className="mt-1 text-sm text-muted-foreground">试试调整搜索或筛选条件</p>
            </div>
        )
    }

    return (
        <>
            <h2 className="sr-only">商品列表</h2>
            <div className={gridClass}>
                {products.map((product, idx) => (
                    <ProductCard
                        key={product.id}
                        product={product}
                        gradientIndex={idx}
                        code={codeParam || undefined}
                    />
                ))}
            </div>

            {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                            key={page}
                            variant={page === currentPage ? "default" : "outline"}
                            size="icon"
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            )}
        </>
    )
}
