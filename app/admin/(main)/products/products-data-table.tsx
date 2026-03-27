"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
} from "@tanstack/react-table"
import { DataTable, ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { productsColumns, type ProductRow } from "./products-columns"

const statusOptions = [
    { label: "全部", value: "" },
    { label: "上架", value: "ACTIVE" },
    { label: "下架", value: "INACTIVE" },
]

export function ProductsDataTable({ data }: { data: ProductRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: productsColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        getRowId: (row) => row.id,
        initialState: { pagination: { pageSize: 20 } },
        state: { sorting, columnFilters, columnVisibility },
    })

    return (
        <div className="space-y-4">
            <ClientDataTableToolbar
                table={table}
                searchColumn="name"
                searchPlaceholder="搜索商品名称…"
                statusColumn="status"
                statusOptions={statusOptions}
            />
            <DataTable table={table} columns={productsColumns} emptyMessage="暂无商品" />
            <ClientDataTablePagination table={table} />
        </div>
    )
}
