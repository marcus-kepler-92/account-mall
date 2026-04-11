"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { GripVertical } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ProductRowActions } from "./product-row-actions"

export type ProductRow = {
    id: string
    name: string
    slug: string
    status: "ACTIVE" | "INACTIVE"
    productType: string
    price: number
    tags: { id: string; name: string; slug: string }[]
    stock: number
}

const statusMap: Record<ProductRow["status"], { label: string; variant: "default" | "secondary" }> = {
    ACTIVE: { label: "上架", variant: "default" },
    INACTIVE: { label: "下架", variant: "secondary" },
}

export const productsColumns: ColumnDef<ProductRow>[] = [
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
        cell: ({ row }) => formatCurrency(row.original.price),
    },
    {
        accessorKey: "stock",
        header: ({ column }) => <DataTableColumnHeader column={column} title="库存" />,
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
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
                />
            </div>
        ),
    },
]
