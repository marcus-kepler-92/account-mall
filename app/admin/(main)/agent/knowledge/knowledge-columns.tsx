"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { formatDateTime } from "@/lib/utils"

export type KnowledgeRow = {
    id: string
    title: string
    content: string
    tags: string[]
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
    createdAt: string
    updatedAt: string
    publishedAt: string | null
}

const statusMap: Record<
    KnowledgeRow["status"],
    { label: string; variant: "default" | "secondary" | "outline" }
> = {
    DRAFT: { label: "草稿", variant: "secondary" },
    PUBLISHED: { label: "已发布", variant: "default" },
    ARCHIVED: { label: "已归档", variant: "outline" },
}

export const knowledgeColumns: ColumnDef<KnowledgeRow>[] = [
    {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="标题" />,
        cell: ({ row }) => (
            <Link
                href={`/admin/agent/knowledge/${row.original.id}`}
                className="font-medium hover:underline truncate block max-w-[280px]"
            >
                {row.original.title}
            </Link>
        ),
    },
    {
        accessorKey: "tags",
        header: "标签",
        cell: ({ row }) => {
            const tags = row.original.tags
            if (!tags || tags.length === 0) return <span className="text-muted-foreground">—</span>
            return (
                <div className="flex flex-wrap gap-1 max-w-[260px]">
                    {tags.map((t) => (
                        <Badge key={t} variant="outline" className="font-normal">
                            {t}
                        </Badge>
                    ))}
                </div>
            )
        },
        filterFn: (row, _id, value: string) => {
            if (!value) return true
            const tags = row.original.tags ?? []
            return tags.some((t) => t.toLowerCase().includes(value.toLowerCase()))
        },
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
        accessorKey: "updatedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="更新时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.updatedAt)}
            </span>
        ),
    },
]
