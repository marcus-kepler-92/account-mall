"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { DataTable } from "@/app/admin/components"
import { formatCurrency } from "@/lib/utils"
import { VariantFormDialog } from "./variant-form-dialog"
import { VariantRowActions } from "./variant-row-actions"

export type VariantRow = {
    id: string
    name: string
    price: string
    unitCost: string | null
    stockQuantity: number
    sortOrder: number
    isActive: boolean
    createdAt: string
}

type ListResponse = { variants: VariantRow[] }

export function VariantsSection({ productId }: { productId: string }) {
    const [createOpen, setCreateOpen] = useState(false)

    const { data, isLoading, refetch } = useQuery<ListResponse>({
        queryKey: ["product-variants", productId],
        queryFn: async () => {
            const res = await fetch(`/api/admin/products/${productId}/variants`)
            if (!res.ok) throw new Error("Failed to load variants")
            return res.json()
        },
    })

    const variants = useMemo(() => data?.variants ?? [], [data])

    const columns = useMemo<ColumnDef<VariantRow>[]>(
        () => [
            {
                accessorKey: "name",
                header: "名称",
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.name}</span>
                ),
            },
            {
                accessorKey: "price",
                header: "售价",
                cell: ({ row }) => formatCurrency(Number(row.original.price)),
            },
            {
                accessorKey: "unitCost",
                header: "成本",
                cell: ({ row }) =>
                    row.original.unitCost
                        ? formatCurrency(Number(row.original.unitCost))
                        : "—",
            },
            {
                accessorKey: "stockQuantity",
                header: "库存",
                cell: ({ row }) => (
                    <span
                        className={
                            row.original.stockQuantity === 0
                                ? "text-destructive"
                                : ""
                        }
                    >
                        {row.original.stockQuantity}
                    </span>
                ),
            },
            {
                accessorKey: "isActive",
                header: "状态",
                cell: ({ row }) =>
                    row.original.isActive ? (
                        <Badge variant="default">启用</Badge>
                    ) : (
                        <Badge variant="secondary">停用</Badge>
                    ),
            },
            {
                accessorKey: "sortOrder",
                header: "排序",
                cell: ({ row }) => (
                    <span className="text-muted-foreground">
                        {row.original.sortOrder}
                    </span>
                ),
            },
            {
                id: "actions",
                header: () => <div className="text-right">操作</div>,
                cell: ({ row }) => (
                    <div className="text-right">
                        <VariantRowActions
                            productId={productId}
                            variant={row.original}
                            onChanged={() => refetch()}
                        />
                    </div>
                ),
                meta: { className: "w-[60px]" },
            },
        ],
        [productId, refetch]
    )

    const table = useReactTable({
        data: variants,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    })

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle>SKU 管理</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        手动发货商品的可售规格；每个 SKU 独立计价与库存
                    </p>
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-4" />
                    新建 SKU
                </Button>
            </CardHeader>
            <CardContent>
                <DataTable
                    table={table}
                    columns={columns}
                    emptyMessage={
                        isLoading ? "加载中…" : "暂无 SKU，请先新建至少一个"
                    }
                />
            </CardContent>

            <VariantFormDialog
                productId={productId}
                mode="create"
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={() => refetch()}
            />
        </Card>
    )
}
