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
    status: string
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
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
        cell: ({ row }) => (
            <Badge variant={row.original.status === "PUBLISHED" ? "default" : "secondary"}>
                {row.original.status === "PUBLISHED" ? "已发布" : "草稿"}
            </Badge>
        ),
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
