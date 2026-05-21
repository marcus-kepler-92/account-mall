"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    useReactTable,
    getCoreRowModel,
    type ColumnDef,
} from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DataTable, DataTablePagination } from "@/app/admin/components"
import { leadsColumns, type LeadRow } from "./leads-columns"
import { LeadsRowActions } from "./leads-row-actions"

interface LeadsDataTableProps {
    data: LeadRow[]
    total: number
}

export function LeadsDataTable({ data, total }: LeadsDataTableProps) {
    const router = useRouter()

    const columns = useMemo<ColumnDef<LeadRow>[]>(
        () => [
            ...leadsColumns,
            {
                id: "actions",
                header: () => <div className="text-right">操作</div>,
                cell: ({ row }) => (
                    <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        <LeadsRowActions row={row.original} />
                    </div>
                ),
            },
        ],
        [],
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        rowCount: total,
    })

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">跟进列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <Separator />
                <DataTable
                    table={table}
                    columns={columns}
                    emptyMessage="暂无跟进单"
                    onRowClick={(row) => router.push(`/admin/agent/leads/${row.id}`)}
                />
                <DataTablePagination table={table} total={total} />
            </CardContent>
        </Card>
    )
}
