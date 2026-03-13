import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { AnnouncementsDataTable } from "./announcements-data-table"
import type { AnnouncementRow } from "./announcements-columns"

export const dynamic = "force-dynamic"

export default async function AdminAnnouncementsPage() {
    const announcements = await prisma.announcement.findMany({
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    })

    const data: AnnouncementRow[] = announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        status: a.status,
        sortOrder: a.sortOrder,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">公告管理</h2>
                    <p className="text-muted-foreground">
                        管理站内公告，已发布的公告将展示在前台首页
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/announcements/new">
                        <Plus className="size-4" />
                        新建公告
                    </Link>
                </Button>
            </div>
            <AnnouncementsDataTable data={data} />
        </div>
    )
}
