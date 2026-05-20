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

type SnapshotMessage = {
    role: string
    contentText: string
    createdAt?: string
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

function parseSnapshot(raw: unknown): SnapshotMessage[] {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((item): SnapshotMessage[] => {
        if (!item || typeof item !== "object") return []
        const o = item as Record<string, unknown>
        const role = typeof o.role === "string" ? o.role : ""
        const contentText =
            typeof o.contentText === "string"
                ? o.contentText
                : typeof o.content === "string"
                  ? o.content
                  : ""
        if (!role && !contentText) return []
        return [
            {
                role,
                contentText,
                createdAt:
                    typeof o.createdAt === "string" ? o.createdAt : undefined,
            },
        ]
    })
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

    const snapshot = parseSnapshot(lead.conversationSnapshot)
    const sessionId = lead.session.id

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
                    <h2 className="text-2xl font-bold tracking-tight">线索详情</h2>
                    <p className="text-muted-foreground text-sm mt-0.5 font-mono">
                        {lead.id}
                    </p>
                </div>
                <Badge variant="outline">{STATUS_LABEL[lead.status]}</Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_320px]">
                {/* Left: conversation snapshot */}
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">对话快照</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {snapshot.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    暂无对话内容
                                </p>
                            ) : (
                                snapshot.map((msg, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="outline">
                                                {ROLE_LABEL[msg.role] ?? msg.role}
                                            </Badge>
                                            {msg.createdAt && (
                                                <span className="text-muted-foreground">
                                                    {formatDateTime(msg.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="pl-3 border-l-2 border-muted">
                                            <MarkdownView content={msg.contentText} />
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
                <div className="space-y-4">
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
                                <p className="whitespace-pre-wrap">{lead.reason}</p>
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
                                    <p className="font-mono text-xs">
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
