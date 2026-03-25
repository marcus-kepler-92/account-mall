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
    { label: "全部", value: "" },
    { label: "待处理", value: "PENDING" },
    { label: "已打款", value: "PAID" },
    { label: "已拒绝", value: "REJECTED" },
]

export function DistributorWithdrawalsDataTable({
    data,
    total,
    statusCounts,
}: DistributorWithdrawalsDataTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        if (typeof window === "undefined") return {} as VisibilityState
        return window.innerWidth < 768 ? { processedAt: false, note: false } : {} as VisibilityState
    })

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
            <DataTableToolbar table={table} searchParamKey="search">
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
                columns={distributorWithdrawalsColumns}
                emptyMessage="暂无提现记录，在「我的奖金」页可提现余额处填写金额并上传收款码，提交后记录将在此展示。"
            />

            <DataTablePagination table={table} total={total} />
        </div>
    )
}
