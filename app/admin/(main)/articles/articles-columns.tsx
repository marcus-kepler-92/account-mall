"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { DataTableColumnHeader } from "@/app/admin/components"
import { ArticleRowActions } from "./article-row-actions"
import { formatDateTime } from "@/lib/utils"

export type ArticleRow = {
    id: string
    title: string
    slug: string
    status: "PUBLISHED" | "DRAFT"
    productCount: number
    publishedAt: string | null
    updatedAt: string
}

const statusMap: Record<ArticleRow["status"], { label: string; variant: "default" | "secondary" }> = {
    PUBLISHED: { label: "已发布", variant: "default" },
    DRAFT: { label: "草稿", variant: "secondary" },
}

export const articlesColumns: ColumnDef<ArticleRow>[] = [
    {
        accessorKey: "title",
        header: ({ column }) => <DataTableColumnHeader column={column} title="标题" />,
        cell: ({ row }) => (
            <div className="min-w-0 max-w-[360px]">
                <Link
                    href={`/admin/articles/${row.original.id}`}
                    className="font-medium hover:underline truncate block"
                >
                    {row.original.title}
                </Link>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    /guides/{row.original.slug}
                </div>
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
        accessorKey: "productCount",
        header: "关联商品",
        cell: ({ row }) => (
            <span className="text-sm tabular-nums">{row.original.productCount}</span>
        ),
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
        accessorKey: "updatedAt",
        header: ({ column }) => <DataTableColumnHeader column={column} title="更新时间" />,
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">
                {formatDateTime(row.original.updatedAt)}
            </span>
        ),
    },
    {
        id: "actions",
        header: () => <div className="text-right">操作</div>,
        cell: ({ row }) => (
            <div className="text-right">
                <ArticleRowActions
                    id={row.original.id}
                    title={row.original.title}
                    slug={row.original.slug}
                    status={row.original.status}
                />
            </div>
        ),
    },
]
