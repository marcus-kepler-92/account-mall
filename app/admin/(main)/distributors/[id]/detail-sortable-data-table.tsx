"use client"

import { useTransition } from "react"
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
    type SortingState,
    type Updater,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import { Card, CardContent } from "@/components/ui/card"
import { DataTable, DataTableToolbar, DataTablePagination } from "@/app/admin/components"
import { sortQueryStates, parseSortingState, encodeSortingState } from "@/lib/table-sort"

const SORT_DEFAULTS = { sort: "createdAt", sortDir: "desc" } as const

type StatusOption = { label: string; value: string }

/**
 * Server-sorted, server-paginated table shared by the orders and commissions
 * detail tabs. Centralizes the nuqs sort wiring + the `page: null` reset on
 * sort change, so a sort never lands on a stale page.
 */
export function DetailSortableDataTable<T extends { id: string }>({
    data,
    total,
    columns,
    statusOptions,
    searchPlaceholder,
    emptyMessage,
}: {
    data: T[]
    total: number
    columns: ColumnDef<T>[]
    statusOptions: StatusOption[]
    searchPlaceholder: string
    emptyMessage: string
}) {
    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition },
    )
    const sorting = parseSortingState(sortState.sort, sortState.sortDir, SORT_DEFAULTS)

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true,
        manualPagination: true,
        manualFiltering: true,
        onSortingChange: (updater: Updater<SortingState>) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            setSortState({ ...encodeSortingState(next, SORT_DEFAULTS), page: null })
        },
        getRowId: (row) => row.id,
    })

    return (
        <Card>
            <CardContent className="space-y-4 pt-6">
                <DataTableToolbar
                    table={table}
                    searchPlaceholder={searchPlaceholder}
                    searchParamKey="search"
                    statusOptions={statusOptions}
                    statusParamKey="status"
                />
                <div
                    className={
                        isPending
                            ? "opacity-50 pointer-events-none transition-opacity"
                            : "transition-opacity"
                    }
                >
                    <DataTable table={table} columns={columns} emptyMessage={emptyMessage} />
                    <DataTablePagination table={table} total={total} />
                </div>
            </CardContent>
        </Card>
    )
}
