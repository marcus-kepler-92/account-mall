import Link from "next/link"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/app/admin/components"
import { Badge } from "@/components/ui/badge"
import { LeadsDataTable } from "./leads-data-table"
import type { LeadRow } from "./leads-columns"
import { parseLeadFilters } from "./leads-filters"

export const dynamic = "force-dynamic"

type SearchParams = Promise<Record<string, string | undefined>>

const STATUS_QUICK_LINKS: { label: string; status?: string }[] = [
    { label: "主待办（待跟进/已联系）" },
    { label: "仅留微信号", status: "PENDING_CONTACT" },
    { label: "已解决", status: "RESOLVED" },
    { label: "已放弃", status: "DROPPED" },
]

export default async function AdminAgentLeadsPage({
    searchParams,
}: {
    searchParams: SearchParams
}) {
    const params = await searchParams
    const filters = parseLeadFilters(params)

    const where: Prisma.AgentLeadWhereInput = {}

    // sessionId filter takes precedence — when ops drills into "all leads
    // of this returning customer", show every status so they see the full
    // history, not just the 主待办 default.
    if (filters.sessionId) {
        where.sessionId = filters.sessionId
    } else if (filters.status) {
        where.status = filters.status
    } else {
        // Default: 主待办视图（NEW + CONTACTED），其他状态通过快捷链接查看
        where.status = { in: ["NEW", "CONTACTED"] }
    }

    if (filters.urgency) {
        where.urgency = filters.urgency
    }

    if (filters.q) {
        where.OR = [
            { wechatId: { contains: filters.q, mode: "insensitive" } },
            { orderNo: { contains: filters.q, mode: "insensitive" } },
            { reason: { contains: filters.q, mode: "insensitive" } },
        ]
    }

    const [leads, total] = await Promise.all([
        prisma.agentLead.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
        }),
        prisma.agentLead.count({ where }),
    ])

    // Count total leads per session (across ALL statuses) for the rows on
    // this page, so the UI can show "this user has N total consultations"
    // — makes it obvious when a row is a repeat customer.
    const sessionIds = Array.from(new Set(leads.map((l) => l.sessionId)))
    const sessionCounts =
        sessionIds.length === 0
            ? []
            : await prisma.agentLead.groupBy({
                  by: ["sessionId"],
                  where: { sessionId: { in: sessionIds } },
                  _count: { _all: true },
              })
    const countBySession = new Map(
        sessionCounts.map((c) => [c.sessionId, c._count._all]),
    )

    const data: LeadRow[] = leads.map((l) => ({
        id: l.id,
        sessionId: l.sessionId,
        wechatId: l.wechatId,
        orderNo: l.orderNo,
        reason: l.reason,
        urgency: l.urgency,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
        sessionLeadCount: countBySession.get(l.sessionId) ?? 1,
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="人工跟进"
                description="AI 转人工 + 用户留了订单号的待处理队列；没留订单号的不进列表"
            />

            {filters.sessionId ? (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">
                        正在查看会话{" "}
                        <span className="font-mono text-foreground">
                            {filters.sessionId.slice(0, 12)}…
                        </span>{" "}
                        的全部跟进记录（共 {total} 条，跨所有状态）
                    </span>
                    <Link
                        href="/admin/agent/leads"
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                        清除筛选
                    </Link>
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    {STATUS_QUICK_LINKS.map((opt) => {
                        const active =
                            (opt.status ?? "") === (filters.status ?? "")
                        const href = opt.status
                            ? `/admin/agent/leads?status=${opt.status}`
                            : "/admin/agent/leads"
                        return (
                            <Link key={opt.label} href={href}>
                                <Badge
                                    variant={active ? "default" : "outline"}
                                    className="cursor-pointer"
                                >
                                    {opt.label}
                                </Badge>
                            </Link>
                        )
                    })}
                </div>
            )}

            <LeadsDataTable data={data} total={total} />
        </div>
    )
}
