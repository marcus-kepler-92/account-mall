"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import { X } from "lucide-react"
import {
    useReactTable,
    getCoreRowModel,
    VisibilityState,
} from "@tanstack/react-table"
import { useQueryStates, parseAsInteger } from "nuqs"
import type { SortingState, Updater } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    inviterFilter: { id: string; name: string; distributorCode: string | null } | null
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
    inviterFilter,
}: DistributorsDataTableProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [selectedRow, setSelectedRow] = useState<DistributorRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [selectLoading, setSelectLoading] = useState(false)

    const handleSelectDistributor = async (id: string) => {
        setSelectLoading(true)
        try {
            const res = await fetch(`/api/admin/distributors/${id}/detail`)
            if (!res.ok) {
                toast.error("加载分销员详情失败")
                return
            }
            const json = await res.json() as { row: DistributorRow }
            setSelectedRow(json.row)
            setSheetOpen(true)
        } catch {
            toast.error("加载分销员详情失败")
        } finally {
            setSelectLoading(false)
        }
    }

    const clearInviterFilter = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("inviterId")
        params.delete("page")
        const qs = params.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }

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
                    {inviterFilter && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">筛选自上线：</span>
                            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                                <Link
                                    href="#"
                                    className="hover:underline"
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleSelectDistributor(inviterFilter.id)
                                    }}
                                >
                                    {inviterFilter.name}
                                    {inviterFilter.distributorCode && (
                                        <span className="text-muted-foreground font-mono ml-1">
                                            ({inviterFilter.distributorCode})
                                        </span>
                                    )}
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-4 hover:bg-transparent"
                                    onClick={clearInviterFilter}
                                    aria-label="清除上线筛选"
                                >
                                    <X className="size-3" />
                                </Button>
                            </Badge>
                        </div>
                    )}
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
                onSelectDistributor={handleSelectDistributor}
                selectLoading={selectLoading}
            />
        </>
    )
}
