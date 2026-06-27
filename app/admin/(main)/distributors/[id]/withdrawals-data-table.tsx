"use client"

import { useReactTable, getCoreRowModel } from "@tanstack/react-table"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, DataTablePagination } from "@/app/admin/components"
import {
    distributorWithdrawalsColumns,
    type DistributorWithdrawalRow,
} from "./withdrawals-columns"

export function DistributorWithdrawalsDataTable({
    data,
    total,
}: {
    data: DistributorWithdrawalRow[]
    total: number
}) {
    const table = useReactTable({
        data,
        columns: distributorWithdrawalsColumns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        getRowId: (row) => row.id,
    })

    return (
        <Card>
            <CardContent className="pt-6">
                <DataTable
                    table={table}
                    columns={distributorWithdrawalsColumns}
                    emptyMessage="暂无提现记录"
                />
                <DataTablePagination table={table} total={total} />
            </CardContent>
        </Card>
    )
}
