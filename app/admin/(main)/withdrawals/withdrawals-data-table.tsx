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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, DataTableViewOptions } from "@/app/admin/components"
import { withdrawalsColumns, type WithdrawalRow } from "./withdrawals-columns"

const statusOptions = [
    { label: "全部", value: "" },
    { label: "待处理", value: "PENDING" },
    { label: "已打款", value: "PAID" },
    { label: "已拒绝", value: "REJECTED" },
]

export function WithdrawalsDataTable({ data }: { data: WithdrawalRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: withdrawalsColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        state: { sorting, columnFilters, columnVisibility },
    })

    const statusFilter = (table.getColumn("status")?.getFilterValue() as string) ?? ""
    const hasFilters = columnFilters.length > 0

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap flex-1 items-center gap-2">
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
            <DataTable
                table={table}
                columns={withdrawalsColumns}
                emptyMessage="暂无提现记录"
            />
        </div>
    )
}
