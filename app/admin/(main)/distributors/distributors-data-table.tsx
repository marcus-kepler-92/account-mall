"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
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
import type { TierSummaryItem } from "@/lib/distributor-tier-summary"
import { InviteDistributorButtonClient } from "./invite-distributor-button-client"
import { DistributorDetailSheet } from "./distributor-detail-sheet"

interface DistributorsDataTableProps {
    data: DistributorRow[]
    total: number
    statusCounts: { enabled: number; disabled: number }
    tiers: TierSummaryItem[]
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
    tiers,
}: DistributorsDataTableProps) {
    const router = useRouter()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [selectedRow, setSelectedRow] = useState<DistributorRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const [isPending, startTransition] = useTransition()
    const [sortState, setSortState] = useQueryStates(
        { ...sortQueryStates, page: parseAsInteger },
        { history: "push", shallow: false, startTransition }
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
        <>
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
                    <div className={isPending ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                        <DataTable
                            table={table}
                            columns={distributorsColumns}
                            emptyMessage="暂无分销员，分销员可通过前台注册成为分销员。"
                            onRowClick={(row) => { setSelectedRow(row); setSheetOpen(true) }}
                        />
                        <DataTablePagination table={table} total={total} />
                    </div>
                </CardContent>
            </Card>

            <DistributorDetailSheet
                row={selectedRow}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                onSuccess={() => router.refresh()}
                tiers={tiers}
            />
        </>
    )
}
