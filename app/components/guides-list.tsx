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
import { GuideRowActions } from "@/app/components/guide-row-actions"

export type GuideItem = {
    id: string
    title: string
    content: string | null
    tagId: string | null
    status: string
    sortOrder: number
    publishedAt: string | null
    createdAt: string
    updatedAt: string
    tag: { id: string; name: string; slug: string } | null
}

type GuidesListProps = {
    guides: GuideItem[]
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

export function GuidesList({ guides }: GuidesListProps) {
    return (
        <>
            <div className="hidden md:block w-full overflow-x-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="min-w-[120px]">标题</TableHead>
                            <TableHead>类目</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>排序</TableHead>
                            <TableHead>发布时间</TableHead>
                            <TableHead>创建时间</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {guides.map((g) => (
                            <TableRow key={g.id}>
                                <TableCell className="font-medium min-w-0 max-w-[280px]">
                                    <Link
                                        href={`/admin/guides/${g.id}`}
                                        className="hover:underline truncate block"
                                    >
                                        {g.title}
                                    </Link>
                                    {g.content && (
                                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 truncate">
                                            {g.content}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {g.tag ? (
                                        <Badge variant="outline">{g.tag.name}</Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            g.status === "PUBLISHED" ? "default" : "secondary"
                                        }
                                    >
                                        {g.status === "PUBLISHED" ? "已发布" : "草稿"}
                                    </Badge>
                                </TableCell>
                                <TableCell>{g.sortOrder}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatDate(g.publishedAt)}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {formatDate(g.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <GuideRowActions id={g.id} title={g.title} status={g.status} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="md:hidden space-y-4">
                {guides.map((g) => (
                    <Card key={g.id}>
                        <CardContent className="pt-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        href={`/admin/guides/${g.id}`}
                                        className="font-medium hover:underline line-clamp-2"
                                    >
                                        {g.title}
                                    </Link>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        {g.tag && (
                                            <Badge variant="outline">{g.tag.name}</Badge>
                                        )}
                                        <Badge
                                            variant={
                                                g.status === "PUBLISHED" ? "default" : "secondary"
                                            }
                                        >
                                            {g.status === "PUBLISHED" ? "已发布" : "草稿"}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            排序 {g.sortOrder}
                                        </span>
                                    </div>
                                    {g.publishedAt && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDate(g.publishedAt)}
                                        </p>
                                    )}
                                </div>
                                <GuideRowActions id={g.id} title={g.title} status={g.status} />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    )
}
