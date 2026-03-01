"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Mail, KeyRound, Globe, Clock } from "lucide-react"
import { toast } from "sonner"
import { parseFreeSharedCardContent, type FreeSharedCardPayload } from "@/lib/free-shared-card"

type OrderSuccessCopySectionProps = {
    cards: string[]
}

export function OrderSuccessCopySection({ cards }: OrderSuccessCopySectionProps) {
    const [copiedAll, setCopiedAll] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const copyAll = async () => {
        if (cards.length === 0) return
        const text = cards.join("\n")
        try {
            await navigator.clipboard.writeText(text)
            setCopiedAll(true)
            toast.success(`已复制 ${cards.length} 条卡密`)
            setTimeout(() => setCopiedAll(false), 2000)
        } catch {
            toast.error("复制失败，请手动复制")
        }
    }

    const copyOne = async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedId(id)
            toast.success("已复制")
            setTimeout(() => setCopiedId(null), 2000)
        } catch {
            toast.error("复制失败")
        }
    }

    if (cards.length === 0) {
        return <p className="text-sm text-muted-foreground">暂无卡密数据</p>
    }

    const isMultiCard = cards.length > 1
    const listClassName = isMultiCard
        ? "grid grid-cols-1 md:grid-cols-2 gap-3"
        : "space-y-2"

    return (
        <div className="space-y-3">
            <Button
                type="button"
                variant="secondary"
                className="w-full gap-2"
                onClick={copyAll}
            >
                {copiedAll ? (
                    <Check className="size-4" />
                ) : (
                    <Copy className="size-4" />
                )}
                一键复制全部卡密（{cards.length} 条）
            </Button>
            <ul className={listClassName}>
                {cards.map((content, i) => {
                    const parsed = parseFreeSharedCardContent(content)
                    if (parsed) {
                        return (
                            <li key={i} className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
                                <FreeSharedCardBlock card={parsed} index={i} copiedId={copiedId} onCopy={copyOne} />
                            </li>
                        )
                    }
                    return (
                        <li
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm"
                        >
                            <span className="min-w-0 flex-1 break-words">{content}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0"
                                onClick={() => copyOne(content, `plain-${i}`)}
                            >
                                {copiedId === `plain-${i}` ? (
                                    <Check className="size-4 text-green-600" />
                                ) : (
                                    <Copy className="size-4" />
                                )}
                            </Button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function FreeSharedCardBlock({
    card,
    index,
    copiedId,
    onCopy,
}: {
    card: FreeSharedCardPayload
    index: number
    copiedId: string | null
    onCopy: (text: string, id: string) => void
}) {
    const prefix = `fs-${index}-`
    return (
        <div className="divide-y divide-border/60">
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">账号</span>
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <code className="min-w-0 break-all font-mono text-sm text-foreground" title={card.account}>
                        {card.account}
                    </code>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                        onClick={() => onCopy(card.account, `${prefix}account`)}
                        aria-label="复制账号"
                    >
                        {copiedId === `${prefix}account` ? (
                            <Check className="size-4 text-emerald-600" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                    </Button>
                </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">密码</span>
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <code className="min-w-0 break-all font-mono text-sm text-foreground" title={card.password}>
                        {card.password}
                    </code>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                        onClick={() => onCopy(card.password, `${prefix}password`)}
                        aria-label="复制密码"
                    >
                        {copiedId === `${prefix}password` ? (
                            <Check className="size-4 text-emerald-600" />
                        ) : (
                            <Copy className="size-4" />
                        )}
                    </Button>
                </div>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">地区</span>
                </div>
                <span className="text-sm font-medium text-foreground break-words">{card.region}</span>
            </div>
            {card.lastCheckedAt != null && card.lastCheckedAt !== "" && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">上次检查</span>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums break-words">{card.lastCheckedAt}</span>
                </div>
            )}
            {card.installStatus != null && card.installStatus !== "" && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">装好状态</span>
                    <span className="text-sm text-foreground break-words">{card.installStatus}</span>
                </div>
            )}
        </div>
    )
}
