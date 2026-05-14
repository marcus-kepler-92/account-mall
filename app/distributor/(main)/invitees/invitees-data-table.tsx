"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
} from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components"
import { Input } from "@/components/ui/input"
import { inviteesColumns, type InviteeRow } from "./invitees-columns"
import { InviteSubDistributorButton } from "../invite-sub-distributor-button"
import { InviteeDetailSheet } from "./invitee-detail-sheet"

interface MilestoneSummary {
    triggeredCount: number
    nextMilestone: {
        thresholdAmount: number
        thresholdCount: number
        bonusAmount: number
        qualifiedCount: number
    } | null
}

interface InviteesDataTableProps {
    data: InviteeRow[]
    level2RatePercent: number
    milestoneSummary?: MilestoneSummary
}

export function InviteesDataTable({ data, level2RatePercent, milestoneSummary }: InviteesDataTableProps) {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [selectedRow, setSelectedRow] = useState<InviteeRow | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)

    const table = useReactTable({
        data,
        columns: inviteesColumns,
        state: { columnFilters, columnVisibility, sorting },
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getRowId: (row) => row.id,
    })

    const showMilestone = milestoneSummary && (milestoneSummary.triggeredCount > 0 || milestoneSummary.nextMilestone !== null)

    return (
        <div className="space-y-4">
            {showMilestone && (
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-1">
                    {milestoneSummary!.triggeredCount > 0 && (
                        <p className="text-green-600 font-medium">
                            已触发 {milestoneSummary!.triggeredCount} 个里程碑奖励
                        </p>
                    )}
                    {milestoneSummary!.nextMilestone && (() => {
                        const { thresholdAmount, thresholdCount, bonusAmount, qualifiedCount } = milestoneSummary!.nextMilestone!
                        return (
                            <p className="text-muted-foreground">
                                下一档：{thresholdCount} 人各满 ¥{thresholdAmount.toFixed(0)} → 奖励 ¥{bonusAmount.toFixed(0)}，
                                当前已有 <span className="text-foreground font-medium">{qualifiedCount}/{thresholdCount}</span> 人达标
                            </p>
                        )
                    })()}
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <Input
                    placeholder="搜索昵称..."
                    value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                    onChange={(e) =>
                        table.getColumn("name")?.setFilterValue(e.target.value)
                    }
                    className="h-8 max-w-sm"
                />
                <InviteSubDistributorButton level2RatePercent={level2RatePercent} />
            </div>
            <DataTable
                table={table}
                columns={inviteesColumns}
                emptyMessage="暂无团队成员，发送邀请后将在此展示。"
                onRowClick={(row) => {
                    setSelectedRow(row)
                    setSheetOpen(true)
                }}
            />
            <InviteeDetailSheet
                row={selectedRow}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />
        </div>
    )
}
