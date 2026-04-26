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
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DataTable, ClientDataTableToolbar, ClientDataTablePagination } from "@/app/admin/components"
import { cardTemplatesColumns, type CardTemplateRow } from "./card-templates-columns"

export function CardTemplatesDataTable({ data }: { data: CardTemplateRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns: cardTemplatesColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 20 } },
    state: { sorting, columnFilters },
  })

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">卡密模版列表</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ClientDataTableToolbar table={table} searchColumn="name" searchPlaceholder="搜索模版名称…" />
        <Separator />
        <DataTable table={table} columns={cardTemplatesColumns} emptyMessage="暂无卡密模版" />
        <ClientDataTablePagination table={table} />
      </CardContent>
    </Card>
  )
}
