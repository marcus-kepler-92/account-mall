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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DataTable, ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { guidesColumns, type GuideRow } from "./guides-columns"

const statusOptions = [
    { label: "全部", value: "" },
    { label: "已发布", value: "PUBLISHED" },
    { label: "草稿", value: "DRAFT" },
]

export function GuidesDataTable({ data }: { data: GuideRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: guidesColumns,
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
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">指南列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <ClientDataTableToolbar
                    table={table}
                    searchColumn="title"
                    searchPlaceholder="搜索标题…"
                    statusColumn="status"
                    statusOptions={statusOptions}
                />
                <Separator />
                <DataTable table={table} columns={guidesColumns} emptyMessage="暂无指南" />
                <ClientDataTablePagination table={table} />
            </CardContent>
        </Card>
    )
}
