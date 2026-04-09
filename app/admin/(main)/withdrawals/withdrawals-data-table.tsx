"use client"

import { useState, useTransition } from "react"
import {
    useReactTable,
    getCoreRowModel,
    type VisibilityState,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
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

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

export function WithdrawalsDataTable({
    data,
    total,
    statusCounts,
}: WithdrawalsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
    )
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    const table = useReactTable({
        data,
        columns: withdrawalsColumns,
        state: { columnVisibility, sorting },
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        onSortingChange: (updater: Updater<SortingState>) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
        },
    })

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">提现记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder="搜索分销员姓名或邮箱..."
                    searchParamKey="search"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                />
                <Separator />
                <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                    <DataTable
                        table={table}
                        columns={withdrawalsColumns}
                        emptyMessage="暂无提现记录"
                    />
                    <DataTablePagination table={table} total={total} />
                </div>
            </CardContent>
        </Card>
    )
}
