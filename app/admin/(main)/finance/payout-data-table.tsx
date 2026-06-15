"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    type SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/app/admin/components"
import { PlusCircle } from "lucide-react"
import { payoutColumns, type PayoutRow } from "./payout-columns"
import { PayoutFormDialog } from "./payout-form-dialog"

export function PayoutDataTable({ initialData }: { initialData: PayoutRow[] }) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data: initialData,
        columns: payoutColumns,
        getRowId: (row) => row.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
        onSortingChange: setSorting,
    })

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">提现记录</h2>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                    <PlusCircle className="size-4" />
                    记一笔提现
                </Button>
            </div>

            <DataTable table={table} columns={payoutColumns} emptyMessage="暂无提现记录" />

            <PayoutFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
    )
}
