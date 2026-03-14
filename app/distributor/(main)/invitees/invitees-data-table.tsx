"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    type ColumnFiltersState,
} from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components"
import { Input } from "@/components/ui/input"
import { inviteesColumns, type InviteeRow } from "./invitees-columns"
import { InviteSubDistributorButton } from "../invite-sub-distributor-button"

interface InviteesDataTableProps {
    data: InviteeRow[]
    level2RatePercent: number
}

export function InviteesDataTable({ data, level2RatePercent }: InviteesDataTableProps) {
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns: inviteesColumns,
        state: { columnFilters },
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getRowId: (row) => row.id,
    })

    return (
        <div className="space-y-4">
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
                emptyMessage="暂无下线，发送邀请后将在此展示。"
            />
        </div>
    )
}
