import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Plus, Megaphone } from "lucide-react"
import { AnnouncementsList } from "@/app/components/announcements-list"
import type { AnnouncementItem } from "@/app/components/announcements-list"

export const dynamic = "force-dynamic"

export default async function AdminAnnouncementsPage() {
    const announcements = await prisma.announcement.findMany({
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    })

    const items: AnnouncementItem[] = announcements.map((a) => ({
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

            {items.length > 0 ? (
                <AnnouncementsList announcements={items} />
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <Megaphone className="size-8 text-muted-foreground" />
                        </div>
                        <CardTitle className="mb-2">暂无公告</CardTitle>
                        <CardDescription className="mb-6 text-center max-w-sm">
                            创建第一条公告，让用户了解维护、活动等信息。
                        </CardDescription>
                        <Button asChild>
                            <Link href="/admin/announcements/new">
                                <Plus className="size-4" />
                                新建公告
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
