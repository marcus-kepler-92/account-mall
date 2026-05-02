import { redirect } from "next/navigation"
import { Megaphone } from "lucide-react"
import { getDistributorSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/app/components/empty-state"
import { AnnouncementsListClient } from "./announcements-list-client"

export const dynamic = "force-dynamic"

export default async function DistributorAnnouncementsPage() {
    const session = await getDistributorSession()
    if (!session) redirect("/distributor/login")

    const userId = session.user.id

    const announcements = await prisma.announcement.findMany({
        where: {
            status: "PUBLISHED",
            audience: { in: ["DISTRIBUTOR", "ALL"] },
        },
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        include: {
            reads: {
                where: { userId },
                select: { id: true },
            },
        },
        take: 100,
    })

    const data = announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        isMandatory: a.isMandatory,
        hasRead: a.reads.length > 0,
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Megaphone className="size-5" />
                        公告
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">分销中心相关公告</p>
                </div>
                {announcements.length > 0 && (
                    <Badge variant="outline">{announcements.length} 条</Badge>
                )}
            </div>
            {announcements.length === 0 ? (
                <EmptyState title="暂无公告" description="目前没有发布任何公告" />
            ) : (
                <AnnouncementsListClient announcements={data} />
            )}
        </div>
    )
}
