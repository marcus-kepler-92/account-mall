"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
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
    { label: "全部", value: "" },
    { label: "待结算", value: "PENDING" },
    { label: "已结算", value: "SETTLED" },
    { label: "已提现", value: "WITHDRAWN" },
]

export function DistributorCommissionsDataTable({
    data,
    total,
    statusCounts,
}: DistributorCommissionsDataTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
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

    const currentStatus = searchParams.get("status") ?? ""

    const handleStatusFilter = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set("status", value)
        } else {
            params.delete("status")
        }
        params.set("page", "1")
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="space-y-4">
            <DataTableToolbar table={table} searchPlaceholder="搜索订单号..." searchParamKey="search">
                <div className="flex items-center gap-1 flex-wrap">
                    {statusOptions.map((opt) => (
                        <Badge
                            key={opt.value}
                            variant={currentStatus === opt.value ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleStatusFilter(opt.value)}
                        >
                            {opt.label}
                            {opt.value && ` (${statusCounts[opt.value as keyof typeof statusCounts]})`}
                        </Badge>
                    ))}
                </div>
            </DataTableToolbar>

            <DataTable
                table={table}
                columns={distributorCommissionsColumns}
                emptyMessage="暂无奖金记录，订单完成后将在此展示。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
