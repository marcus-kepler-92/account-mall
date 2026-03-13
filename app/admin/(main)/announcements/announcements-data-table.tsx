"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
} from "@tanstack/react-table"
import { X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTableViewOptions } from "@/app/admin/components"
import { announcementsColumns, type AnnouncementRow } from "./announcements-columns"

const statusOptions = [
    { label: "全部", value: "" },
    { label: "已发布", value: "PUBLISHED" },
    { label: "草稿", value: "DRAFT" },
]

export function AnnouncementsDataTable({ data }: { data: AnnouncementRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: announcementsColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        state: { sorting, columnFilters, columnVisibility },
    })

    const titleFilter = (table.getColumn("title")?.getFilterValue() as string) ?? ""
    const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? ""
    const hasFilters = columnFilters.length > 0

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap flex-1 items-center gap-2">
                    <Input
                        placeholder="搜索标题…"
                        value={titleFilter}
                        onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
                        className="h-8 w-[150px] lg:w-[250px]"
                    />
                    <div className="flex items-center gap-1">
                        {statusOptions.map((opt) => (
                            <Badge
                                key={opt.value}
                                variant={statusFilter === opt.value ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() =>
                                    table.getColumn("status")?.setFilterValue(opt.value || undefined)
                                }
                            >
                                {opt.label}
                            </Badge>
                        ))}
                    </div>
                    {hasFilters && (
                        <Button
                            variant="ghost"
                            onClick={() => table.resetColumnFilters()}
                            className="h-8 px-2 lg:px-3"
                        >
                            重置
                            <X className="ml-2 size-4" />
                        </Button>
                    )}
                </div>
                <DataTableViewOptions table={table} />
            </div>
            <DataTable table={table} columns={announcementsColumns} emptyMessage="暂无公告" />
        </div>
    )
}
