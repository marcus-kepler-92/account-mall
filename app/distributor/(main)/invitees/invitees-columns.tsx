"use client"

import { ColumnDef } from "@tanstack/react-table"
import { DataTableColumnHeader } from "@/app/admin/components/data-table-column-header"

export type InviteeRow = {
    id: string
    name: string
    email: string
    createdAt: string
    level2CommissionTotal: number
}

export const inviteesColumns: ColumnDef<InviteeRow>[] = [
    {
        accessorKey: "name",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="昵称" />
        ),
        cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
        ),
    },
    {
        accessorKey: "email",
        header: "邮箱",
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {row.original.email}
            </span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="加入时间" />
        ),
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {new Date(row.original.createdAt).toLocaleDateString("zh-CN")}
            </span>
        ),
    },
    {
        accessorKey: "level2CommissionTotal",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="为我创造团队佣金" className="justify-end" />
        ),
        cell: ({ row }) => (
            <div className="text-right font-medium">
                ¥{row.original.level2CommissionTotal.toFixed(2)}
            </div>
        ),
    },
]
