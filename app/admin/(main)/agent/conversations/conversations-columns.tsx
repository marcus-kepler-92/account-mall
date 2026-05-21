"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatDateTime } from "@/lib/utils"

export type ConvRow = {
    id: string
    fingerprintHash: string
    messageCount: number
    tokensUsed: number
    escalated: boolean
    hasLead: boolean
    startedAt: string
    endedAt: string | null
}

export const conversationsColumns: ColumnDef<ConvRow>[] = [
    {
        accessorKey: "id",
        header: "会话 ID",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.id.slice(0, 8)}</span>
        ),
    },
    {
        accessorKey: "fingerprintHash",
        header: "指纹",
        cell: ({ row }) => (
            <span className="font-mono text-xs text-muted-foreground">
                {row.original.fingerprintHash.slice(0, 6)}
            </span>
        ),
    },
    {
        accessorKey: "messageCount",
        header: "消息数",
        cell: ({ row }) => (
            <span className="tabular-nums text-sm">{row.original.messageCount}</span>
        ),
    },
    {
        accessorKey: "tokensUsed",
        header: "Tokens",
        cell: ({ row }) => (
            <span className="tabular-nums text-sm">{row.original.tokensUsed}</span>
        ),
    },
    {
        accessorKey: "escalated",
        header: "升级",
        cell: ({ row }) =>
            row.original.escalated ? (
                <Badge variant="destructive">是</Badge>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "hasLead",
        header: "跟进单",
        cell: ({ row }) =>
            row.original.hasLead ? (
                <span className="text-success text-sm">✓</span>
            ) : (
                <span className="text-muted-foreground">—</span>
            ),
    },
    {
        accessorKey: "startedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="开始时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.startedAt)}
            </span>
        ),
    },
]
