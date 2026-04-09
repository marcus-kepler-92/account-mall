"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
    DataTable,
    DataTableToolbar,
    DataTablePagination,
} from "@/app/admin/components"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"
import { distributorsColumns, type DistributorRow } from "./distributors-columns"
import { InviteDistributorButtonClient } from "./invite-distributor-button-client"

interface DistributorsDataTableProps {
    data: DistributorRow[]
    total: number
    statusCounts: { enabled: number; disabled: number }
}

const statusOptions = [
    { label: "启用", value: "enabled" },
    { label: "已停用", value: "disabled" },
]

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

export function DistributorsDataTable({
    data,
    total,
    statusCounts,
}: DistributorsDataTableProps) {
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push" }
    )
    const sorting: SortingState = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    const table = useReactTable({
        data,
        columns: distributorsColumns,
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
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">分销员列表</CardTitle>
                    <InviteDistributorButtonClient />
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder="搜索昵称、邮箱、优惠码..."
                    searchParamKey="search"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                />
                <Separator />
                <DataTable
                    table={table}
                    columns={distributorsColumns}
                    emptyMessage="暂无分销员，分销员可通过前台注册成为分销员。"
                />
                <DataTablePagination table={table} total={total} />
            </CardContent>
        </Card>
    )
}
