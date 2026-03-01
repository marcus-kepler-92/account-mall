"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { AnnouncementRowActions } from "@/app/components/announcement-row-actions"

export type AnnouncementItem = {
    id: string
    title: string
    content: string | null
    status: string
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
}

type AnnouncementsListProps = {
    announcements: AnnouncementItem[]
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    return d.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function AnnouncementsList({ announcements }: AnnouncementsListProps) {
    return (
        <>
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[120px]">标题</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>排序</TableHead>
                            <TableHead>发布时间</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {announcements.map((a) => (
                            <TableRow key={a.id}>
                                <TableCell className="font-medium min-w-0 max-w-[280px]">
                                    <Link
                                        href={`/admin/announcements/${a.id}`}
                                        className="hover:underline truncate block"
                                    >
                                        {a.title}
                                    </Link>
                                    {a.content && (
                                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 truncate">
                                            {a.content}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            a.status === "PUBLISHED" ? "default" : "secondary"
                                        }
                                    >
                                        {a.status === "PUBLISHED" ? "已发布" : "草稿"}
                                    </Badge>
                                </TableCell>
                                <TableCell>{a.sortOrder}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatDate(a.publishedAt)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatDate(a.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <AnnouncementRowActions id={a.id} title={a.title} status={a.status} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="md:hidden space-y-4">
                {announcements.map((a) => (
                    <Card key={a.id}>
                        <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/admin/announcements/${a.id}`}
                                        className="font-medium hover:underline line-clamp-2"
                                    >
                                        {a.title}
                                    </Link>
                                    <div className="mt-1 flex items-center gap-2">
                                        <Badge
                                            variant={
                                                a.status === "PUBLISHED" ? "default" : "secondary"
                                            }
                                        >
                                            {a.status === "PUBLISHED" ? "已发布" : "草稿"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            排序 {a.sortOrder}
                                        </span>
                                    </div>
                                    {a.publishedAt && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDate(a.publishedAt)}
                                        </p>
                                    )}
                                </div>
                                <AnnouncementRowActions id={a.id} title={a.title} status={a.status} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    )
}
