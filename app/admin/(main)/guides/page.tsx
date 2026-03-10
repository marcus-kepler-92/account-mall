import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, BookOpen } from "lucide-react"
import { GuidesList } from "@/app/components/guides-list"
import type { GuideItem } from "@/app/components/guides-list"

export const dynamic = "force-dynamic"

export default async function AdminGuidesPage() {
    const guides = await prisma.distributorGuide.findMany({
        orderBy: [
            { sortOrder: "desc" },
            { publishedAt: "desc" },
            { createdAt: "desc" },
        ],
        include: {
            tag: { select: { id: true, name: true, slug: true } },
        },
    })

    const items: GuideItem[] = guides.map((g) => ({
        id: g.id,
        title: g.title,
        content: g.content,
        tagId: g.tagId,
        status: g.status,
        sortOrder: g.sortOrder,
        publishedAt: g.publishedAt?.toISOString() ?? null,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        tag: g.tag,
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">分销指南</h2>
                    <p className="text-muted-foreground">
                        管理分销员入门手册，已发布的指南将展示在分销员端「入门手册」
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/guides/new">
                        <Plus className="size-4" />
                        新建指南
                    </Link>
                </Button>
            </div>

            {items.length > 0 ? (
                <GuidesList guides={items} />
            ) : (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <div className="rounded-full bg-muted p-4 mb-4">
                            <BookOpen className="size-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-semibold mb-2">暂无指南</h3>
                        <p className="text-muted-foreground text-center max-w-sm mb-6">
                            创建第一条分销员入门手册，包含商品上架、话术、引流文案等，分销员可直接复制使用。
                        </p>
                        <Button asChild>
                            <Link href="/admin/guides/new">
                                <Plus className="size-4" />
                                新建指南
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
