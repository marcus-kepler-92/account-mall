"use client"

import { useMemo, useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    DataTable,
    DataTableViewOptions,
    ClientDataTablePagination,
} from "@/app/admin/components"
import { knowledgeColumns, type KnowledgeRow } from "./knowledge-columns"
import { KnowledgeRowActions } from "./knowledge-row-actions"

const statusOptions = [
    { label: "全部", value: "" },
    { label: "草稿", value: "DRAFT" },
    { label: "已发布", value: "PUBLISHED" },
    { label: "已归档", value: "ARCHIVED" },
]

export function KnowledgeDataTable({ rows }: { rows: KnowledgeRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [globalFilter, setGlobalFilter] = useState("")

    const columns = useMemo<ColumnDef<KnowledgeRow>[]>(
        () => [
            ...knowledgeColumns,
            {
                id: "actions",
                header: () => <div className="text-right">操作</div>,
                cell: ({ row }) => (
                    <div className="text-right">
                        <KnowledgeRowActions row={row.original} />
                    </div>
                ),
            },
        ],
        [],
    )

    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: (row, _id, value: string) => {
            if (!value) return true
            const v = value.toLowerCase()
            const r = row.original
            if (r.title.toLowerCase().includes(v)) return true
            if (r.content.toLowerCase().includes(v)) return true
            if (r.tags?.some((t) => t.toLowerCase().includes(v))) return true
            return false
        },
        getRowId: (row) => row.id,
        initialState: { pagination: { pageSize: 20 } },
        state: { sorting, columnFilters, columnVisibility, globalFilter },
    })

    const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? ""

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">知识列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap flex-1 items-center gap-2">
                        <Input
                            placeholder="搜索标题/正文/标签…"
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="h-8 w-[180px] lg:w-[280px]"
                        />
                        <div className="flex items-center gap-1">
                            {statusOptions.map((opt) => (
                                <Badge
                                    key={opt.value}
                                    variant={statusFilter === opt.value ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() =>
                                        table
                                            .getColumn("status")
                                            ?.setFilterValue(opt.value || undefined)
                                    }
                                >
                                    {opt.label}
                                </Badge>
                            ))}
                        </div>
                    </div>
                    <DataTableViewOptions table={table} />
                </div>
                <Separator />
                <DataTable table={table} columns={columns} emptyMessage="暂无知识条目" />
                <ClientDataTablePagination table={table} />
            </CardContent>
        </Card>
    )
}
