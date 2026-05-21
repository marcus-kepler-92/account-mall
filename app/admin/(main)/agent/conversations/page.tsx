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

    // Resolve sessionIds from both search inputs (free text + dedicated
    // orderNo). Each input independently produces a sessionId set; we
    // intersect at the end so both filters tighten the result rather
    // than confusing each other. Capped at 500 per scan.
    const sessionIdSets: Array<Set<string>> = []
    if (filters.q) {
        const hits = await prisma.agentMessage.findMany({
            where: {
                contentText: { contains: filters.q, mode: "insensitive" },
            },
            select: { sessionId: true },
            distinct: ["sessionId"],
            take: 500,
        })
        sessionIdSets.push(new Set(hits.map((h) => h.sessionId)))
    }
    if (filters.orderNo) {
        // Match the orderNo either persisted on an AgentLead (definitive)
        // or mentioned anywhere in the conversation transcript (catches
        // sessions where AI did not formally enqueue a follow-up).
        const [leadHits, msgHits] = await Promise.all([
            prisma.agentLead.findMany({
                where: { orderNo: filters.orderNo },
                select: { sessionId: true },
                distinct: ["sessionId"],
                take: 500,
            }),
            prisma.agentMessage.findMany({
                where: {
                    contentText: { contains: filters.orderNo, mode: "insensitive" },
                },
                select: { sessionId: true },
                distinct: ["sessionId"],
                take: 500,
            }),
        ])
        const merged = new Set<string>()
        for (const h of leadHits) merged.add(h.sessionId)
        for (const h of msgHits) merged.add(h.sessionId)
        sessionIdSets.push(merged)
    }
    let sessionIdFilter: string[] | undefined
    if (sessionIdSets.length > 0) {
        const [first, ...rest] = sessionIdSets
        const intersection = new Set(first)
        for (const s of rest) {
            for (const id of intersection) if (!s.has(id)) intersection.delete(id)
        }
        sessionIdFilter = Array.from(intersection)
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
                      // 1:N — count leads instead of fetching the relation; the
                      // list view only needs to know "has any lead", and Prisma
                      // _count is cheaper than pulling rows.
                      _count: { select: { messages: true, leads: true } },
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
        hasLead: s._count.leads > 0,
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
                initialOrderNo={filters.orderNo}
                escalatedOnly={filters.escalated === true}
            />

            {noMatches ? (
                <Card>
                    <CardContent className="py-16 text-center text-sm text-muted-foreground">
                        没有匹配
                        {filters.orderNo ? `订单号「${filters.orderNo}」` : ""}
                        {filters.q && filters.orderNo ? " 且 " : ""}
                        {filters.q ? `「${filters.q}」` : ""}
                        的会话
                    </CardContent>
                </Card>
            ) : (
                <ConversationsDataTable data={data} total={total} />
            )}
        </div>
    )
}
