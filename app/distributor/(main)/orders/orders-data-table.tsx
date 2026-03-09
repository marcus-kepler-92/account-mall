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
import { distributorOrdersColumns, type DistributorOrderRow } from "./orders-columns"

interface DistributorOrdersDataTableProps {
    data: DistributorOrderRow[]
    total: number
    statusCounts: {
        PENDING: number
        COMPLETED: number
        CLOSED: number
    }
}

const statusOptions = [
    { label: "待支付", value: "PENDING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "已关闭", value: "CLOSED" },
]

export function DistributorOrdersDataTable({
    data,
    total,
    statusCounts,
}: DistributorOrdersDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: distributorOrdersColumns,
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
                searchPlaceholder="搜索订单号..."
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
                columns={distributorOrdersColumns}
                emptyMessage="暂无订单，分享推广链接获得订单后将在此展示。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
