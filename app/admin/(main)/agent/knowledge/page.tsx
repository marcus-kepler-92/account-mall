import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PageHeader } from "@/app/admin/components"
import { KnowledgeDataTable } from "./knowledge-data-table"
import type { KnowledgeRow } from "./knowledge-columns"

export const dynamic = "force-dynamic"

export default async function AdminAgentKnowledgePage() {
    const rows = await prisma.agentKnowledge.findMany({
        orderBy: { updatedAt: "desc" },
    })

    const data: KnowledgeRow[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        tags: r.tags,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        publishedAt: r.publishedAt?.toISOString() ?? null,
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="知识库"
                description="管理客服 Agent 可检索的知识条目"
            >
                <Button asChild size="sm">
                    <Link href="/admin/agent/knowledge/new">
                        <Plus className="size-4" />
                        新建
                    </Link>
                </Button>
            </PageHeader>
            <KnowledgeDataTable rows={data} />
        </div>
    )
}
