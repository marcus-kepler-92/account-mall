"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
} from "@tanstack/react-table"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
    DataTableFacetedFilter,
} from "@/app/admin/components"
import { distributorsColumns, type DistributorRow } from "./distributors-columns"

interface DistributorsDataTableProps {
    data: DistributorRow[]
    total: number
    statusCounts: { enabled: number; disabled: number }
}

const statusOptions = [
    { label: "启用", value: "enabled" },
    { label: "已停用", value: "disabled" },
]

export function DistributorsDataTable({
    data,
    total,
    statusCounts,
}: DistributorsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: distributorsColumns,
        state: { columnVisibility },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
    })

    const statusOptionsWithCounts = statusOptions.map((opt) => ({
        ...opt,
        count: statusCounts[opt.value as keyof typeof statusCounts],
    }))

    return (
        <div className="space-y-4">
            <DataTableToolbar
                table={table}
                searchPlaceholder="搜索昵称、邮箱、优惠码..."
                searchParamKey="search"
            >
                <DataTableFacetedFilter
                    column={table.getColumn("disabledAt")}
                    title="状态"
                    options={statusOptionsWithCounts}
                    paramKey="status"
                />
            </DataTableToolbar>

            <DataTable
                table={table}
                columns={distributorsColumns}
                emptyMessage="暂无分销员，分销员可通过前台注册成为分销员。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
