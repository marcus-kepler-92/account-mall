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
import { distributorWithdrawalsColumns, type DistributorWithdrawalRow } from "./withdrawals-columns"

interface DistributorWithdrawalsDataTableProps {
    data: DistributorWithdrawalRow[]
    total: number
    statusCounts: {
        PENDING: number
        PAID: number
        REJECTED: number
    }
}

const statusOptions = [
    { label: "待处理", value: "PENDING" },
    { label: "已打款", value: "PAID" },
    { label: "已拒绝", value: "REJECTED" },
]

export function DistributorWithdrawalsDataTable({
    data,
    total,
    statusCounts,
}: DistributorWithdrawalsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const table = useReactTable({
        data,
        columns: distributorWithdrawalsColumns,
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
            <DataTableToolbar table={table}>
                <DataTableFacetedFilter
                    column={table.getColumn("status")}
                    title="状态"
                    options={statusOptionsWithCounts}
                    paramKey="status"
                />
            </DataTableToolbar>

            <DataTable
                table={table}
                columns={distributorWithdrawalsColumns}
                emptyMessage="暂无提现记录，在「我的佣金」页可提现余额处填写金额并上传收款码，提交后记录将在此展示。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
