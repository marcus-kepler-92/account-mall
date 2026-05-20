import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components"
import { Card, CardContent } from "@/components/ui/card"
import { ConversationsDataTable } from "./conversations-data-table"
import { ConversationsToolbar } from "./conversations-toolbar"
import type { ConvRow } from "./conversations-columns"
import { parseConvFilters } from "./conversations-filters"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | undefined>>

export default async function AdminAgentConversationsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const params = await searchParams
    const filters = parseConvFilters(params)

    // Phase 1: if user supplied a search term, find matching sessionIds via
    // ILIKE over AgentMessage.contentText (distinct, capped at 500).
    let sessionIdFilter: string[] | undefined
    if (filters.q) {
        const hits = await prisma.agentMessage.findMany({
            where: {
                contentText: { contains: filters.q, mode: "insensitive" },
            },
            select: { sessionId: true },
            distinct: ["sessionId"],
            take: 500,
        })
        sessionIdFilter = hits.map((h) => h.sessionId)
    }

    const noMatches =
        sessionIdFilter !== undefined && sessionIdFilter.length === 0

    const where: Prisma.AgentSessionWhereInput = {}
    if (sessionIdFilter) where.id = { in: sessionIdFilter }
    if (filters.escalated !== undefined) where.escalated = filters.escalated
    if (filters.from || filters.to) {
        where.startedAt = {}
        if (filters.from) where.startedAt.gte = filters.from
        if (filters.to) where.startedAt.lte = filters.to
    }

    const [sessions, total] = noMatches
        ? [[], 0]
        : await Promise.all([
              prisma.agentSession.findMany({
                  where,
                  include: {
                      _count: { select: { messages: true } },
                      lead: { select: { id: true } },
                  },
                  orderBy: { startedAt: "desc" },
                  skip: (filters.page - 1) * filters.pageSize,
                  take: filters.pageSize,
              }),
              prisma.agentSession.count({ where }),
          ])

    const data: ConvRow[] = sessions.map((s) => ({
        id: s.id,
        fingerprintHash: s.fingerprintHash,
        messageCount: s._count.messages,
        tokensUsed: s.tokensUsed,
        escalated: s.escalated,
        hasLead: s.lead !== null,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt?.toISOString() ?? null,
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="客服会话"
                description="Agent 与访客的对话记录，支持按消息内容搜索"
            />

            <ConversationsToolbar
                initialQuery={filters.q}
                escalatedOnly={filters.escalated === true}
            />

            {noMatches ? (
                <Card>
                    <CardContent className="py-16 text-center text-sm text-muted-foreground">
                        没有匹配「{filters.q}」的会话
                    </CardContent>
                </Card>
            ) : (
                <ConversationsDataTable data={data} total={total} />
            )}
        </div>
    )
}
