"use client"

import { useRouter } from "next/navigation"
import { useReactTable, getCoreRowModel } from "@tanstack/react-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DataTable, DataTablePagination } from "@/app/admin/components"
import { conversationsColumns, type ConvRow } from "./conversations-columns"

interface ConversationsDataTableProps {
    data: ConvRow[]
    total: number
}

export function ConversationsDataTable({
    data,
    total,
}: ConversationsDataTableProps) {
    const router = useRouter()

    const table = useReactTable({
        data,
        columns: conversationsColumns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
        manualPagination: true,
        manualFiltering: true,
        rowCount: total,
    })

    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">会话列表</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
                <Separator />
                <DataTable
                    table={table}
                    columns={conversationsColumns}
                    emptyMessage="暂无会话"
                    onRowClick={(row) =>
                        router.push(`/admin/agent/conversations/${row.id}`)
                    }
                />
                <DataTablePagination table={table} total={total} />
            </CardContent>
        </Card>
    )
}
