import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, MessageSquare, ExternalLink } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MarkdownView } from "@/app/components/markdown-view"
import { LeadStatusForm } from "./lead-status-form"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ id: string }>
}

const STATUS_LABEL: Record<string, string> = {
    PENDING_CONTACT: "待补充",
    NEW: "待跟进",
    CONTACTED: "已联系",
    RESOLVED: "已解决",
    DROPPED: "已放弃",
}

const URGENCY_LABEL: Record<string, string> = {
    LOW: "低",
    MED: "中",
    HIGH: "高",
}

const ROLE_LABEL: Record<string, string> = {
    USER: "访客",
    ASSISTANT: "Agent",
    TOOL: "工具",
    SYSTEM: "系统",
}

export default async function AdminAgentLeadDetailPage({ params }: PageProps) {
    const { id } = await params

    const lead = await prisma.agentLead.findUnique({
        where: { id },
        include: {
            session: {
                select: {
                    id: true,
                    fingerprintHash: true,
                    tokensUsed: true,
                    escalated: true,
                    startedAt: true,
                },
            },
        },
    })

    if (!lead) notFound()

    // Show LIVE messages scoped to this lead's consultation window, not
    // the frozen conversationSnapshot. The snapshot column only captures
    // up to the moment escalate / collect_wechat fired; after that the
    // user often keeps chatting (chat history persists across refresh
    // via sessionStorage), and ops needs to see those follow-up
    // messages to decide if the lead is still relevant.
    //
    // Window = (previousLead.createdAt OR session.startedAt) → nextLead.createdAt
    // OR present. Each lead's view scopes to its own consultation.
    const sessionId = lead.session.id
    const [previousLead, nextLead] = await Promise.all([
        prisma.agentLead.findFirst({
            where: { sessionId, createdAt: { lt: lead.createdAt } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        }),
        prisma.agentLead.findFirst({
            where: { sessionId, createdAt: { gt: lead.createdAt } },
            orderBy: { createdAt: "asc" },
            select: { createdAt: true },
        }),
    ])

    // Window lower bound: the previous lead's createdAt, or the session
    // start if this is the first lead. `gt` (not `gte`) skips the
    // boundary message that triggered the previous escalation.
    const lowerBound = previousLead?.createdAt ?? lead.session.startedAt
    const messages = await prisma.agentMessage.findMany({
        where: {
            sessionId,
            createdAt: nextLead
                ? { gt: lowerBound, lte: nextLead.createdAt }
                : { gt: lowerBound },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
            id: true,
            role: true,
            contentText: true,
            toolName: true,
            createdAt: true,
        },
    })

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/agent/leads">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight">跟进详情</h2>
                    <p className="text-muted-foreground text-sm mt-0.5 font-mono break-all">
                        {lead.id}
                    </p>
                </div>
                <Badge variant="outline" className="shrink-0">{STATUS_LABEL[lead.status]}</Badge>
            </div>

            {/* min-w-0 on the grid container so children can shrink below
                their intrinsic content width — without it, a long markdown
                block or unbroken URL inside the snapshot pushes the grid
                wider than the viewport. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] min-w-0">
                {/* Left: live conversation window for this lead */}
                <div className="space-y-4 min-w-0">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle className="text-base">
                                对话内容
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    （本次咨询窗口，含跟进单建后用户继续说的话）
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 min-w-0">
                            {messages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    本次咨询窗口暂无消息
                                </p>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id} className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 text-xs flex-wrap">
                                            <Badge variant="outline">
                                                {ROLE_LABEL[msg.role] ?? msg.role}
                                            </Badge>
                                            {msg.toolName && (
                                                <Badge variant="secondary" className="font-mono text-[10px]">
                                                    {msg.toolName}
                                                </Badge>
                                            )}
                                            <span className="text-muted-foreground">
                                                {formatDateTime(msg.createdAt)}
                                            </span>
                                            {msg.createdAt > lead.createdAt && (
                                                <Badge variant="outline" className="text-[10px]">
                                                    跟进单后
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="pl-3 border-l-2 border-muted min-w-0 overflow-x-auto">
                                            <MarkdownView content={msg.contentText ?? ""} />
                                        </div>
                                    </div>
                                ))
                            )}
                            <Separator />
                            <Button asChild variant="outline" size="sm">
                                <Link
                                    href={`/admin/agent/conversations/${sessionId}`}
                                >
                                    <MessageSquare className="size-4" />
                                    查看完整会话
                                    <ExternalLink className="size-4" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: metadata + status form */}
                <div className="space-y-4 min-w-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">基本信息</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground">微信号</p>
                                <p className="font-mono break-all">
                                    {lead.wechatId ?? "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">订单号</p>
                                <p className="font-mono break-all">
                                    {lead.orderNo ?? "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">原因</p>
                                <p className="whitespace-pre-wrap break-words">{lead.reason}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">紧急度</p>
                                <p>{URGENCY_LABEL[lead.urgency]}</p>
                            </div>
                            <Separator />
                            <div>
                                <p className="text-xs text-muted-foreground">创建时间</p>
                                <p>{formatDateTime(lead.createdAt)}</p>
                            </div>
                            {lead.contactedAt && (
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        联系时间
                                    </p>
                                    <p>{formatDateTime(lead.contactedAt)}</p>
                                </div>
                            )}
                            {lead.contactedBy && (
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        联系人
                                    </p>
                                    <p className="font-mono text-xs break-all">
                                        {lead.contactedBy}
                                    </p>
                                </div>
                            )}
                            <Separator />
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    会话指纹
                                </p>
                                <p className="font-mono text-xs break-all">
                                    {lead.session.fingerprintHash.slice(0, 16)}…
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    Tokens 用量
                                </p>
                                <p>{lead.session.tokensUsed}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">状态流转</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LeadStatusForm
                                leadId={lead.id}
                                currentStatus={lead.status}
                                initialNotes={lead.notes ?? ""}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
