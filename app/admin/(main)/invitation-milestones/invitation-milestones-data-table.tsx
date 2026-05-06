"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
} from "@tanstack/react-table"
import { DataTable } from "@/app/admin/components"
import { invitationMilestonesColumns, type MilestoneRow } from "./invitation-milestones-columns"

export function InvitationMilestonesDataTable({ data }: { data: MilestoneRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data,
        columns: invitationMilestonesColumns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onSortingChange: setSorting,
        getRowId: (row) => row.id,
        state: { sorting },
    })

    return (
        <DataTable
            table={table}
            columns={invitationMilestonesColumns}
            emptyMessage="暂无里程碑配置，点击右上角「添加里程碑」创建。"
        />
    )
}
