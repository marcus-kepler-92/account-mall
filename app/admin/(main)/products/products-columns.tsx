"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ProductRowActions } from "./product-row-actions"

export type ProductRow = {
    id: string
    name: string
    slug: string
    status: string
    price: number
    pinnedAt: string | null
    tags: { id: string; name: string; slug: string }[]
    stock: number
}

export const productsColumns: ColumnDef<ProductRow>[] = [
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
                    {row.original.pinnedAt && (
                        <Badge variant="secondary" className="text-xs">
                            置顶
                        </Badge>
                    )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">/{row.original.slug}</div>
            </div>
        ),
    },
    {
        accessorKey: "price",
        header: ({ column }) => <DataTableColumnHeader column={column} title="价格" />,
        cell: ({ row }) => `¥${row.original.price.toFixed(2)}`,
    },
    {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="库存" />,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => (
            <Badge variant={row.original.status === "ACTIVE" ? "default" : "secondary"}>
                {row.original.status === "ACTIVE" ? "上架" : "下架"}
            </Badge>
        ),
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
                    pinnedAt={row.original.pinnedAt}
                />
            </div>
        ),
    },
]
