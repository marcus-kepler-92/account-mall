import { UserSearch } from "lucide-react"
import type { Prisma } from "@prisma/client"
import type { NotificationSource, AgentLeadItem } from "@/lib/admin-notifications"

const URGENCY_RANK = { HIGH: 3, MED: 2, LOW: 1 } as const

export const agentLeadsSource: NotificationSource<"agentLeads"> = {
  key: "agentLeads",
  label: "客服跟进",
  icon: UserSearch,
  menuHref: "/admin/agent/leads",
  viewAllHref: "/admin/agent/leads",
  async fetch(prisma) {
    const where: Prisma.AgentLeadWhereInput = { status: { in: ["NEW", "CONTACTED"] } }
    const [count, rows] = await Promise.all([
      prisma.agentLead.count({ where }),
      prisma.agentLead.findMany({
        where,
        take: 9,
        orderBy: { createdAt: "desc" },
        select: { id: true, wechatId: true, status: true, urgency: true, createdAt: true },
      }),
    ])

    const items: AgentLeadItem[] = rows
      .map((r) => ({
        id: r.id,
        displayName: r.wechatId ?? "匿名",
        status: r.status as "NEW" | "CONTACTED",
        urgency: r.urgency as "LOW" | "MED" | "HIGH",
        createdAt: r.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        const byUrgency = URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]
        if (byUrgency !== 0) return byUrgency
        return b.createdAt.localeCompare(a.createdAt)
      })
      .slice(0, 3)

    return { count, items }
  },
}
