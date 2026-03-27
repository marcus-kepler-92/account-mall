"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
    DataTableFacetedFilter,
} from "@/app/admin/components"
import { withdrawalsColumns, type WithdrawalRow } from "./withdrawals-columns"
import type { WithdrawalFiltersState } from "./withdrawals-filters"

interface WithdrawalsDataTableProps {
    data: WithdrawalRow[]
    total: number
    statusCounts: {
        PENDING: number
        PAID: number
        REJECTED: number
    }
    defaultFilters: WithdrawalFiltersState
}

const statusOptions = [
    { label: "待处理", value: "PENDING" },
    { label: "已打款", value: "PAID" },
    { label: "已拒绝", value: "REJECTED" },
]

export function WithdrawalsDataTable({
    data,
    total,
    statusCounts,
}: WithdrawalsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: withdrawalsColumns,
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
                searchPlaceholder="搜索分销员姓名或邮箱..."
                searchParamKey="search"
            >
                <DataTableFacetedFilter
                    column={table.getColumn("status")}
                    title="状态"
                    options={statusOptionsWithCounts}
                    paramKey="status"
                />
            </DataTableToolbar>

            <DataTable
                table={table}
                columns={withdrawalsColumns}
                emptyMessage="暂无提现记录"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
