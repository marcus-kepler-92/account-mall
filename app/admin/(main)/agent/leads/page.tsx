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

    if (filters.status) {
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

    const data: LeadRow[] = leads.map((l) => ({
        id: l.id,
        sessionId: l.sessionId,
        wechatId: l.wechatId,
        orderNo: l.orderNo,
        reason: l.reason,
        urgency: l.urgency,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
    }))

    return (
        <div className="space-y-6">
            <PageHeader
                title="客服线索"
                description="Agent 收集到的微信号线索与人工跟进队列"
            />

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

            <LeadsDataTable data={data} total={total} />
        </div>
    )
}
