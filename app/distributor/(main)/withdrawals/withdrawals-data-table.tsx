"use client"

import { useState, useEffect, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
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

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

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
    const [isPending, startTransition] = useTransition()
    const [{ sort, sortDir }, setQuery] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition },
    )
    const sorting = parseSortingState(sort, sortDir, SORT_DEFAULTS)
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    useEffect(() => {
        if (window.innerWidth < 768) {
            setColumnVisibility({ processedAt: false, note: false })
        }
    }, [])

    const table = useReactTable({
        data,
        columns: distributorWithdrawalsColumns,
        state: { columnVisibility, sorting },
        onColumnVisibilityChange: setColumnVisibility,
        onSortingChange: (updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            setQuery({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
        },
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
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

            <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                <DataTable
                    table={table}
                    columns={distributorWithdrawalsColumns}
                    emptyMessage="暂无提现记录，在「我的奖金」页可提现余额处填写金额并上传收款码，提交后记录将在此展示。"
                />

                <DataTablePagination table={table} total={total} />
            </div>
        </div>
    )
}
