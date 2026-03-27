"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { AnnouncementRowActions } from "./announcement-row-actions"
import { formatDateTime } from "@/lib/utils"

export type AnnouncementRow = {
    id: string
    title: string
    content: string | null
    status: "PUBLISHED" | "DRAFT"
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
}

const statusMap: Record<AnnouncementRow["status"], { label: string; variant: "default" | "secondary" }> = {
    PUBLISHED: { label: "已发布", variant: "default" },
    DRAFT: { label: "草稿", variant: "secondary" },
}

export const announcementsColumns: ColumnDef<AnnouncementRow>[] = [
    {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="标题" />,
        cell: ({ row }) => (
            <div className="min-w-0 max-w-[280px]">
                <Link
                    href={`/admin/announcements/${row.original.id}`}
                    className="font-medium hover:underline truncate block"
                >
                    {row.original.title}
                </Link>
                {row.original.content && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 truncate">
                        {row.original.content}
                    </div>
                )}
            </div>
        ),
    },
    {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => {
            const { label, variant } = statusMap[row.original.status]
            return <Badge variant={variant}>{label}</Badge>
        },
        filterFn: (row, id, value: string) => !value || row.getValue(id) === value,
    },
    {
        accessorKey: "sortOrder",
        header: ({ column }) => <DataTableColumnHeader column={column} title="排序" />,
    },
    {
        accessorKey: "publishedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="发布时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.publishedAt)}
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
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <AnnouncementRowActions
                    id={row.original.id}
                    title={row.original.title}
                    status={row.original.status}
                />
            </div>
        ),
    },
]
