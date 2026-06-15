"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { GripVertical, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ProductRowActions } from "./product-row-actions"
import { ProductStockCell } from "./product-stock-cell"

export type ProductRow = {
    id: string
    name: string
    slug: string
    status: "ACTIVE" | "INACTIVE"
    productType: string
    // Sortable numeric value. For MANUAL: min active-variant price; for
    // AUTO_FETCH/NORMAL: product.price. Display goes through priceLabel.
    price: number
    // Pre-formatted label. MANUAL may show "¥9.90 起" or "—"; AUTO_FETCH/NORMAL
    // show "¥X.XX".
    priceLabel: string
    tags: { id: string; name: string; slug: string }[]
    // Sortable numeric stock. Unlimited rows (AUTO_FETCH, untracked MANUAL) use
    // Number.MAX_SAFE_INTEGER as a sentinel so they sort to the high end.
    stock: number
    // Pre-formatted label: count for NORMAL/tracked MANUAL, "不限" for the rest.
    stockLabel: string
    sales: number
    subscriberCount: number
    hasAlert: boolean
    // Active variant count — only meaningful for MANUAL products. Used to
    // surface a "缺 SKU" warning badge when a MANUAL product is ACTIVE but
    // has zero active variants (misconfigured row that can't be sold).
    activeVariantCount: number
    // Product-level default purchase cost, prefilled into the inline bulk-import
    // dialog. Only used for NORMAL products (the ones with a card pool).
    costPerUnit: number | null
}

const statusMap: Record<ProductRow["status"], { label: string; variant: "default" | "secondary" }> = {
    ACTIVE: { label: "上架", variant: "default" },
    INACTIVE: { label: "下架", variant: "secondary" },
}

export function createProductsColumns(isSuperAdmin: boolean): ColumnDef<ProductRow>[] {
return [
    {
        id: "drag-handle",
        header: () => null,
        cell: () => (
            <span className="drag-handle flex items-center justify-center cursor-grab text-muted-foreground">
                <GripVertical className="size-4" />
            </span>
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="名称" />,
        cell: ({ row }) => (
            <div>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/admin/products/${row.original.id}`}
                        className="font-medium hover:underline"
                    >
                        {row.original.name}
                    </Link>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">/{row.original.slug}</div>
            </div>
        ),
    },
    {
        accessorKey: "price",
        header: ({ column }) => <DataTableColumnHeader column={column} title="价格" />,
        cell: ({ row }) => row.original.priceLabel,
    },
    {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="库存" />,
        cell: ({ row }) => (
            <ProductStockCell
                productId={row.original.id}
                productType={row.original.productType}
                stock={row.original.stock}
                stockLabel={row.original.stockLabel}
                subscriberCount={row.original.subscriberCount}
                costPerUnit={row.original.costPerUnit}
            />
        ),
    },
    {
        accessorKey: "sales",
        header: ({ column }) => <DataTableColumnHeader column={column} title="销量" />,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            const missingSku =
                row.original.productType === "MANUAL" &&
                row.original.status === "ACTIVE" &&
                row.original.activeVariantCount === 0
            return (
                <div className="flex flex-wrap items-center gap-1">
                    <Badge variant={variant}>{label}</Badge>
                    {missingSku && (
                        <Badge
                            variant="destructive"
                            className="gap-1"
                            title="MANUAL 商品当前为「上架」但没有任何启用的 SKU，无法被购买。请补充 SKU 或将商品下架。"
                        >
                            <AlertTriangle className="size-3" />
                            缺 SKU
                        </Badge>
                    )}
                </div>
            )
        },
        filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
    },
    {
        id: "tags",
        accessorFn: (row) => row.tags.map((t) => t.name).join(", "),
        header: "标签",
        cell: ({ row }) => (
            <div className="flex flex-wrap gap-1">
                {row.original.tags.map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                        {tag.name}
                    </Badge>
                ))}
            </div>
        ),
    },
    {
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <ProductRowActions
                    productId={row.original.id}
                    productName={row.original.name}
                    slug={row.original.slug}
                    status={row.original.status}
                    productType={row.original.productType}
                    isFree={row.original.productType === "AUTO_FETCH" && row.original.price === 0}
                    isSuperAdmin={isSuperAdmin}
                />
            </div>
        ),
    },
    {
        accessorKey: "hasAlert",
        header: () => null,
        cell: () => null,
        enableHiding: true,
        enableColumnFilter: true,
        enableSorting: false,
        size: 0,
        filterFn: (row, _id, value) => {
            if (value === undefined) return true
            return row.original.hasAlert === Boolean(value)
        },
    },
]
}
