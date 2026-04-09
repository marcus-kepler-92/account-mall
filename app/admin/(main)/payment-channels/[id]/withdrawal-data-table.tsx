"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    type SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusCircle } from "lucide-react"
import { withdrawalColumns, type WithdrawalRow } from "./withdrawal-columns"
import { WithdrawalFormDialog } from "./withdrawal-form-dialog"

type Props = {
    channelId: string
    initialData: WithdrawalRow[]
}

export function WithdrawalDataTable({ channelId, initialData }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false)
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data: initialData,
        columns: withdrawalColumns,
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
                    记录提现
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={withdrawalColumns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    暂无提现记录
                                </TableCell>
                            </TableRow>
                        ) : (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <WithdrawalFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                channelId={channelId}
            />
        </div>
    )
}
