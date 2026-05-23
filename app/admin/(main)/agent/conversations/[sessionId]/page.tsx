import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MarkdownView } from "@/app/components/markdown-view"

export const dynamic = "force-dynamic"

type PageProps = {
    params: Promise<{ sessionId: string }>
}

const ROLE_LABEL: Record<string, string> = {
    USER: "访客",
    ASSISTANT: "Agent",
    TOOL: "工具",
    SYSTEM: "系统",
}

const ROLE_VARIANT: Record<
    string,
    "default" | "secondary" | "outline" | "destructive"
> = {
    USER: "default",
    ASSISTANT: "secondary",
    TOOL: "outline",
    SYSTEM: "outline",
}

const LEAD_STATUS_LABEL: Record<string, string> = {
    PENDING_CONTACT: "待补充",
    NEW: "待跟进",
    CONTACTED: "已联系",
    RESOLVED: "已解决",
    DROPPED: "已放弃",
}

export default async function AdminAgentConversationDetailPage({
    params,
}: PageProps) {
    const { sessionId } = await params

    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        include: {
            messages: { orderBy: { createdAt: "asc" } },
            // 1:N — show the most recent lead in the side panel and a count
            // badge. Each escalate_to_human / collect_wechat call now produces
            // a fresh lead instead of upserting, so a long-running session
            // can accumulate many distinct consultations.
            leads: { orderBy: { createdAt: "desc" } },
        },
    })

    if (!session) notFound()
    const latestLead = session.leads[0] ?? null
    const totalLeads = session.leads.length

    const totalInputTokens = session.messages.reduce(
        (sum, m) => sum + m.inputTokens,
        0,
    )
    const totalOutputTokens = session.messages.reduce(
        (sum, m) => sum + m.outputTokens,
        0,
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/agent/conversations">
                        <ArrowLeft className="size-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold tracking-tight">会话详情</h2>
                    <p className="text-muted-foreground text-sm mt-0.5 font-mono break-all">
                        {session.id}
                    </p>
                </div>
                {session.escalated && <Badge variant="destructive" className="shrink-0">已升级</Badge>}
            </div>

            {/* lg breakpoint (not md): admin sidebar eats ~250px, so at md
                (768px) the content area only gets ~520px — splitting that
                into 1fr+320px leaves the messages column ~200px, way too
                narrow for chat content. lg (1024px) → content ~770px,
                messages get ~440px which is usable.
                minmax(0,1fr) + min-w-0: long markdown / tool JSON / IDs
                can't push the 1fr column past the viewport. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] min-w-0">
                {/* Left: messages timeline */}
                <div className="space-y-4 min-w-0">
                    <Card className="min-w-0">
                        <CardHeader>
                            <CardTitle className="text-base">
                                消息时间线（{session.messages.length}）
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5 min-w-0">
                            {session.messages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    暂无消息
                                </p>
                            ) : (
                                session.messages.map((m) => (
                                    <div key={m.id} className="space-y-2 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <Badge variant={ROLE_VARIANT[m.role]}>
                                                {ROLE_LABEL[m.role] ?? m.role}
                                            </Badge>
                                            <span className="text-muted-foreground">
                                                {formatDateTime(m.createdAt)}
                                            </span>
                                            {m.toolName && (
                                                <span className="text-muted-foreground">
                                                    · tool: {m.toolName}
                                                </span>
                                            )}
                                            {(m.inputTokens > 0 || m.outputTokens > 0) && (
                                                <span className="text-muted-foreground">
                                                    · in:{m.inputTokens}/out:{m.outputTokens}
                                                </span>
                                            )}
                                            {m.feedback === "POSITIVE" && (
                                                <span className="inline-flex items-center gap-1 text-success">
                                                    <ThumbsUp className="size-3" />
                                                    好评
                                                </span>
                                            )}
                                            {m.feedback === "NEGATIVE" && (
                                                <span className="inline-flex items-center gap-1 text-destructive">
                                                    <ThumbsDown className="size-3" />
                                                    差评
                                                </span>
                                            )}
                                        </div>
                                        <div className="pl-3 border-l-2 border-muted min-w-0 overflow-x-auto">
                                            {m.role === "TOOL" ? (
                                                <details className="text-xs">
                                                    <summary className="cursor-pointer text-muted-foreground">
                                                        {m.contentText || "工具调用参数与结果"}
                                                    </summary>
                                                    <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                                                        {JSON.stringify(m.parts, null, 2)}
                                                    </pre>
                                                </details>
                                            ) : (
                                                <MarkdownView content={m.contentText} />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right: metadata */}
                <div className="space-y-4 min-w-0">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">会话信息</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <p className="text-xs text-muted-foreground">指纹</p>
                                <p className="font-mono text-xs break-all">
                                    {session.fingerprintHash}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">开始时间</p>
                                <p>{formatDateTime(session.startedAt)}</p>
                            </div>
                            {session.endedAt && (
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        结束时间
                                    </p>
                                    <p>{formatDateTime(session.endedAt)}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-muted-foreground">过期时间</p>
                                <p>{formatDateTime(session.expiresAt)}</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Tokens 用量
                                    </p>
                                    <p className="tabular-nums">{session.tokensUsed}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Tokens 预算
                                    </p>
                                    <p className="tabular-nums">{session.tokenBudget}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        输入 tokens
                                    </p>
                                    <p className="tabular-nums">{totalInputTokens}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        输出 tokens
                                    </p>
                                    <p className="tabular-nums">{totalOutputTokens}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {latestLead ? (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    最新线索{totalLeads > 1 && `（共 ${totalLeads} 条）`}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div>
                                    <p className="text-xs text-muted-foreground">状态</p>
                                    <Badge variant="outline">
                                        {LEAD_STATUS_LABEL[latestLead.status]}
                                    </Badge>
                                </div>
                                {latestLead.wechatId && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            微信号
                                        </p>
                                        <p className="font-mono break-all">
                                            {latestLead.wechatId}
                                        </p>
                                    </div>
                                )}
                                {latestLead.orderNo && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            订单号
                                        </p>
                                        <p className="font-mono break-all">
                                            {latestLead.orderNo}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-muted-foreground">原因</p>
                                    <p className="whitespace-pre-wrap">
                                        {latestLead.reason}
                                    </p>
                                </div>
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/admin/agent/leads/${latestLead.id}`}>
                                        查看跟进详情
                                        <ExternalLink className="size-4" />
                                    </Link>
                                </Button>
                                {totalLeads > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                        该会话还有 {totalLeads - 1} 条历史跟进 ——
                                        到{" "}
                                        <Link
                                            href={`/admin/agent/leads?sessionId=${session.id}`}
                                            className="underline"
                                        >
                                            跟进列表
                                        </Link>
                                        {" "}查看全部
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="py-6 text-center text-sm text-muted-foreground">
                                此会话未生成跟进单（用户未留订单号）
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
