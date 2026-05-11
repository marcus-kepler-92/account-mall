"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Check, Mail, KeyRound, Globe, Clock, Info } from "lucide-react"
import { toast } from "sonner"
import type { ResolvedCard } from "@/lib/card-format"
import type { AutoFetchCardPayload } from "@/lib/auto-fetch-card"
import { formatAutoFetchCardForCopy } from "@/lib/auto-fetch-card"

export type CardDisplayItem =
    | ResolvedCard
    | { type: "autoFetch"; payload: AutoFetchCardPayload }

type OrderCardDisplayProps = {
    cards: CardDisplayItem[]
}

export function OrderCardDisplay({ cards }: OrderCardDisplayProps) {
    const [copiedAll, setCopiedAll] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const copyAll = async () => {
        if (cards.length === 0) return
        const lines = cards.map((item) => {
            if (item.type === "autoFetch") return formatAutoFetchCardForCopy(item.payload)
            if (item.type === "formatted") return item.fields.map((f) => `${f.label}：${f.value}`).join("\n")
            return item.content
        })
        try {
            await navigator.clipboard.writeText(lines.join("\n\n"))
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

    return (
        <div className="space-y-3">
            <Button type="button" variant="secondary" className="w-full gap-2" onClick={copyAll}>
                {copiedAll ? <Check className="size-4" /> : <Copy className="size-4" />}
                一键复制全部卡密（{cards.length} 条）
            </Button>

            <ul className={isMultiCard ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-2"}>
                {cards.map((item, i) => {
                    if (item.type === "autoFetch") {
                        const { payload } = item
                        const prefix = `card-${i}`
                        return (
                            <li key={i} className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
                                <div className="divide-y divide-border/60">
                                    <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">账号</span>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                            <code className="min-w-0 truncate font-mono text-sm text-foreground" title={payload.account}>{payload.account}</code>
                                            <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                                                onClick={() => copyOne(payload.account, `${prefix}-account`)} aria-label="复制账号">
                                                {copiedId === `${prefix}-account` ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-muted/30">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">密码</span>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                            <code className="min-w-0 truncate font-mono text-sm text-foreground" title={payload.password}>{payload.password}</code>
                                            <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full hover:bg-background cursor-pointer"
                                                onClick={() => copyOne(payload.password, `${prefix}-password`)} aria-label="复制密码">
                                                {copiedId === `${prefix}-password` ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">地区</span>
                                        </div>
                                        <span className="text-sm font-medium text-foreground">{payload.region}</span>
                                    </div>
                                    {payload.lastCheckedAt && payload.lastCheckedAt !== "" && (
                                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">上次检查</span>
                                            </div>
                                            <span className="text-sm text-muted-foreground tabular-nums">{payload.lastCheckedAt}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-2.5 px-4 py-3 rounded-b-lg bg-amber-500/5 border-t border-amber-500/10 text-xs text-muted-foreground">
                                    <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" aria-hidden />
                                    <p className="leading-relaxed">
                                        仅用于 App Store，请勿在设置或 iCloud 登录。如密码失效，可在下方获取最新密码。
                                    </p>
                                </div>
                            </li>
                        )
                    }

                    if (item.type === "formatted") {
                        const copyText = item.fields.map((f) => `${f.label}：${f.value}`).join("\n")
                        return (
                            <li key={i} className="rounded-lg border border-border/80 bg-card shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
                                    <span className="text-xs text-muted-foreground">№{i + 1}</span>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                                        onClick={() => copyOne(copyText, `card-${i}`)}>
                                        {copiedId === `card-${i}` ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                                        复制
                                    </Button>
                                </div>
                                <div className="divide-y divide-border/60">
                                    {item.fields.map((field, j) => (
                                        <div key={j} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                            <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">{field.label}</span>
                                            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                                <code className="min-w-0 break-all font-mono text-sm text-foreground">{field.value}</code>
                                                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 rounded-full hover:bg-muted"
                                                    onClick={() => copyOne(field.value, `field-${i}-${j}`)} aria-label={`复制${field.label}`}>
                                                    {copiedId === `field-${i}-${j}` ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </li>
                        )
                    }

                    return (
                        <li key={i} className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 font-mono text-sm">
                            <span className="min-w-0 flex-1 break-words">{item.content}</span>
                            <Button type="button" variant="ghost" size="icon" className="shrink-0"
                                onClick={() => copyOne(item.content, `plain-${i}`)}>
                                {copiedId === `plain-${i}` ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                            </Button>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}
