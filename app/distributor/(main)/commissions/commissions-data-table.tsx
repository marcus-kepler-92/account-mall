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
import { distributorCommissionsColumns, type DistributorCommissionRow } from "./commissions-columns"

interface DistributorCommissionsDataTableProps {
    data: DistributorCommissionRow[]
    total: number
    statusCounts: {
        PENDING: number
        SETTLED: number
        WITHDRAWN: number
    }
}

const statusOptions = [
    { label: "待结算", value: "PENDING" },
    { label: "已结算", value: "SETTLED" },
    { label: "已提现", value: "WITHDRAWN" },
]

export function DistributorCommissionsDataTable({
    data,
    total,
    statusCounts,
}: DistributorCommissionsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: distributorCommissionsColumns,
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
            <DataTableToolbar table={table} searchPlaceholder="搜索订单号..." searchParamKey="search">
                <DataTableFacetedFilter
                    column={table.getColumn("status")}
                    title="状态"
                    options={statusOptionsWithCounts}
                    paramKey="status"
                />
            </DataTableToolbar>

            <DataTable
                table={table}
                columns={distributorCommissionsColumns}
                emptyMessage="暂无佣金记录，订单完成后将在此展示。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
