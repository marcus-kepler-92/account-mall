"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatDateTime } from "@/lib/utils"

export type LeadRow = {
    id: string
    sessionId: string
    wechatId: string | null
    orderNo: string | null
    reason: string
    urgency: "LOW" | "MED" | "HIGH"
    status: "PENDING_CONTACT" | "NEW" | "CONTACTED" | "RESOLVED" | "DROPPED"
    createdAt: string
}

const statusMap: Record<
    LeadRow["status"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
    PENDING_CONTACT: { label: "待补充", variant: "outline" },
    NEW: { label: "待跟进", variant: "default" },
    CONTACTED: { label: "已联系", variant: "secondary" },
    RESOLVED: { label: "已解决", variant: "outline" },
    DROPPED: { label: "已放弃", variant: "outline" },
}

const urgencyMap: Record<
    LeadRow["urgency"],
    { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
    LOW: { label: "低", variant: "outline" },
    MED: { label: "中", variant: "secondary" },
    HIGH: { label: "高", variant: "destructive" },
}

function truncateWechat(id: string | null): string {
    if (!id) return "—"
    if (id.length <= 16) return id
    return id.slice(0, 14) + "…"
}

export const leadsColumns: ColumnDef<LeadRow>[] = [
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
        },
    },
    {
        accessorKey: "urgency",
        header: "紧急度",
        cell: ({ row }) => {
            const { label, variant } = urgencyMap[row.original.urgency]
            return <Badge variant={variant}>{label}</Badge>
        },
    },
    {
        accessorKey: "wechatId",
        header: "微信号",
        cell: ({ row }) => (
            <span className="font-mono text-xs">{truncateWechat(row.original.wechatId)}</span>
        ),
    },
    {
        accessorKey: "orderNo",
        header: "订单号",
        cell: ({ row }) => (
            <span className="font-mono text-xs text-muted-foreground">
                {row.original.orderNo ?? "—"}
            </span>
        ),
    },
    {
        accessorKey: "reason",
        header: "原因",
        cell: ({ row }) => (
            <span
                className="line-clamp-1 block max-w-[24ch] text-sm"
                title={row.original.reason}
            >
                {row.original.reason}
            </span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="创建时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.createdAt)}
            </span>
        ),
    },
    {
        id: "linkSession",
        header: "会话",
        cell: ({ row }) => (
            <Link
                href={`/admin/agent/conversations/${row.original.sessionId}`}
                className="text-xs text-muted-foreground hover:underline font-mono"
                onClick={(e) => e.stopPropagation()}
            >
                {row.original.sessionId.slice(0, 8)}
            </Link>
        ),
    },
]
