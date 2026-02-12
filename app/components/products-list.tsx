"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ProductRowActions } from "@/app/components/product-row-actions"

type Product = {
    id: string
    name: string
    slug: string
    status: string
    price: number
    tags: { id: string; name: string; slug: string }[]
}

type ProductsListProps = {
    products: Product[]
    stockMap: Record<string, number>
}

export function ProductsList({ products, stockMap }: ProductsListProps) {
    return (
        <>
            {/* Desktop: Table */}
            <div className="hidden md:block rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>名称</TableHead>
                            <TableHead>价格</TableHead>
                            <TableHead>库存</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>标签</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => (
                            <TableRow key={product.id}>
                                <TableCell className="font-medium">
                                    <Link
                                        href={`/admin/products/${product.id}`}
                                        className="hover:underline"
                                    >
                                        {product.name}
                                    </Link>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        /{product.slug}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    ¥{Number(product.price).toFixed(2)}
                                </TableCell>
                                <TableCell>{stockMap[product.id] ?? 0}</TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            product.status === "ACTIVE"
                                                ? "default"
                                                : "secondary"
                                        }
                                    >
                                        {product.status === "ACTIVE" ? "上架" : "下架"}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {product.tags.map((tag) => (
                                            <Badge
                                                key={tag.id}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <ProductRowActions
                                        productId={product.id}
                                        productName={product.name}
                                        slug={product.slug}
                                        status={product.status}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden space-y-4">
                {products.map((product) => (
                    <Card key={product.id}>
                        <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/admin/products/${product.id}`}
                                        className="font-medium hover:underline truncate block"
                                    >
                                        {product.name}
                                    </Link>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        /{product.slug}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {product.tags.map((tag) => (
                                            <Badge
                                                key={tag.id}
                                                variant="outline"
                                                className="text-xs"
                                            >
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="mt-3 flex items-center gap-3 text-sm">
                                        <span>¥{Number(product.price).toFixed(2)}</span>
                                        <span className="text-muted-foreground">
                                            库存 {stockMap[product.id] ?? 0}
                                        </span>
                                        <Badge
                                            variant={
                                                product.status === "ACTIVE"
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {product.status === "ACTIVE" ? "上架" : "下架"}
                                        </Badge>
                                    </div>
                                </div>
                                <ProductRowActions
                                    productId={product.id}
                                    productName={product.name}
                                    slug={product.slug}
                                    status={product.status}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    )
}
