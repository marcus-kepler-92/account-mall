"use client"

import { useState, type ReactNode } from "react"
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
import { campaignsColumns, type CampaignRow } from "./campaigns-columns"

const statusOptions = [
  { label: "全部", value: "" },
  { label: "草稿", value: "DRAFT" },
  { label: "发送中", value: "SENDING" },
  { label: "已发送", value: "SENT" },
  { label: "失败", value: "FAILED" },
]

export function CampaignsDataTable({ data, actions }: { data: CampaignRow[]; actions?: ReactNode }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns: campaignsColumns,
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">群发活动</CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ClientDataTableToolbar
          table={table}
          searchColumn="name"
          searchPlaceholder="搜索活动名称…"
          statusColumn="status"
          statusOptions={statusOptions}
        />
        <Separator />
        <DataTable table={table} columns={campaignsColumns} emptyMessage="暂无活动" />
        <ClientDataTablePagination table={table} />
      </CardContent>
    </Card>
  )
}
