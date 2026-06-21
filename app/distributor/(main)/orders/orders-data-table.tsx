"use client"

import { useState, useTransition } from "react"
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
import { distributorOrdersColumns, type DistributorOrderRow } from "./orders-columns"

interface DistributorOrdersDataTableProps {
    data: DistributorOrderRow[]
    total: number
    statusCounts: {
        PENDING: number
        COMPLETED: number
        CLOSED: number
        REFUNDED: number
    }
}

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

const statusOptions = [
    { label: "全部", value: "" },
    { label: "待支付", value: "PENDING" },
    { label: "已完成", value: "COMPLETED" },
    { label: "已关闭", value: "CLOSED" },
    { label: "已退款", value: "REFUNDED" },
]

export function DistributorOrdersDataTable({
    data,
    total,
    statusCounts,
}: DistributorOrdersDataTableProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()
    const [{ sort, sortDir }, setQuery] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition },
    )
    const sorting = parseSortingState(sort, sortDir, SORT_DEFAULTS)
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
        if (typeof window === "undefined") return {} as VisibilityState
        return window.innerWidth < 768 ? { quantity: false, createdAt: false } : {} as VisibilityState
    })

    const table = useReactTable({
        data,
        columns: distributorOrdersColumns,
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

            <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                <DataTable
                    table={table}
                    columns={distributorOrdersColumns}
                    emptyMessage="暂无订单，分享推广链接获得订单后将在此展示。"
                />

                <DataTablePagination table={table} total={total} />
            </div>
        </div>
    )
}
