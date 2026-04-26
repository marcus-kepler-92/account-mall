import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { GuidesDataTable } from "./guides-data-table"
import type { GuideRow } from "./guides-columns"
import { PageHeader } from "@/app/admin/components"

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

    const data: GuideRow[] = guides.map((g) => ({
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
            <PageHeader title="分销指南" description="管理分销员入门手册，已发布的指南将展示在分销员端「入门手册」">
                <Button asChild size="sm">
                    <Link href="/admin/guides/new">
                        <Plus className="size-4" />
                        新建指南
                    </Link>
                </Button>
            </PageHeader>
            <GuidesDataTable data={data} />
        </div>
    )
}
