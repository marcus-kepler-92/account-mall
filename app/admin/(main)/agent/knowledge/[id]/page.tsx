import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { KnowledgeForm } from "../knowledge-form"
import type { KnowledgeRow } from "../knowledge-columns"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ id: string }>
}

export default async function AdminEditKnowledgePage({ params }: PageProps) {
    const { id } = await params

    const row = await prisma.agentKnowledge.findUnique({
        where: { id },
    })

    if (!row) {
        notFound()
    }

    const initial: KnowledgeRow = {
        id: row.id,
        title: row.title,
        content: row.content,
        tags: row.tags,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        publishedAt: row.publishedAt?.toISOString() ?? null,
    }

    return <KnowledgeForm id={id} initial={initial} />
}
