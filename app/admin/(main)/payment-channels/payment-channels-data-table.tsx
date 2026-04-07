"use client"

import { useState } from "react"
import {
    useReactTable,
    getCoreRowModel,
    flexRender,
} from "@tanstack/react-table"
import { Plus, Pencil, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { paymentChannelsColumns, type ChannelRow } from "./payment-channels-columns"
import { ChannelFormDialog } from "./channel-form-dialog"
import { ChannelWithdrawalDialog } from "./channel-withdrawal-dialog"

export function PaymentChannelsDataTable({ data }: { data: ChannelRow[] }) {
    const [formDialog, setFormDialog] = useState<{ open: boolean; channel?: ChannelRow | null }>({
        open: false,
        channel: null,
    })
    const [withdrawalDialog, setWithdrawalDialog] = useState<{
        open: boolean
        channelId: string
        channelNickname: string
    } | null>(null)

    const table = useReactTable({
        data,
        columns: paymentChannelsColumns,
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row) => row.id,
    })

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setFormDialog({ open: true, channel: null })}>
                    <Plus className="size-4" />
                    添加渠道
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                                <TableHead>操作</TableHead>
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={paymentChannelsColumns.length + 1} className="text-center text-muted-foreground py-8">
                                    暂无收款渠道，点击右上角添加
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
                                    <TableCell>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => setFormDialog({ open: true, channel: row.original })}
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                onClick={() => setWithdrawalDialog({
                                                    open: true,
                                                    channelId: row.original.id,
                                                    channelNickname: row.original.nickname,
                                                })}
                                            >
                                                <Wallet className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <ChannelFormDialog
                open={formDialog.open}
                onOpenChange={(open) => setFormDialog((s) => ({ ...s, open }))}
                channel={formDialog.channel}
            />

            {withdrawalDialog && (
                <ChannelWithdrawalDialog
                    open={withdrawalDialog.open}
                    onOpenChange={(open) => {
                        if (!open) setWithdrawalDialog(null)
                    }}
                    channelId={withdrawalDialog.channelId}
                    channelNickname={withdrawalDialog.channelNickname}
                />
            )}
        </div>
    )
}
