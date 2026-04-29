"use client"

import { useState, useCallback, useRef } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ResolvedCard } from "@/lib/card-format"

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    UNSOLD: { label: "未售", className: "border-success/50 bg-success/10 text-success" },
    RESERVED: { label: "预占中", className: "border-warning/50 bg-warning/10 text-warning" },
    DISABLED: { label: "停用", className: "border-muted-foreground/30 bg-muted/50 text-muted-foreground" },
    SOLD: { label: "已售", className: "border-muted-foreground/30 bg-muted text-muted-foreground" },
}

export type CardDetailEntry = {
    content: string
    status: string
    resolved: ResolvedCard
}

export function CardDetailSheet({
    card,
    title = "卡密详情",
    onClose,
}: {
    card: CardDetailEntry | null
    title?: string
    onClose: () => void
}) {
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    const copy = useCallback(async (text: string, id: string) => {
        try {
            await navigator.clipboard.writeText(text)
            clearTimeout(copiedTimerRef.current)
            setCopiedId(id)
            copiedTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
            toast.success("已复制")
        } catch {
            toast.error("复制失败")
        }
    }, [])

    const copyAll = useCallback(async (c: CardDetailEntry) => {
        const text =
            c.resolved.type === "formatted"
                ? c.resolved.fields.map((f) => `${f.label}：${f.value}`).join("\n")
                : c.content
        try {
            await navigator.clipboard.writeText(text)
            toast.success("已复制全部")
        } catch {
            toast.error("复制失败")
        }
    }, [])

    return (
        <Sheet open={!!card} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                {card && (
                    <>
                        <SheetHeader className="pb-4">
                            <SheetTitle className="flex items-center gap-2">
                                {title}
                                <Badge variant="outline" className={STATUS_MAP[card.status]?.className}>
                                    {STATUS_MAP[card.status]?.label}
                                </Badge>
                            </SheetTitle>
                        </SheetHeader>

                        {card.resolved.type === "formatted" ? (
                            <div className="space-y-4 px-4 pb-4">
                                <div className="rounded-lg border divide-y divide-border/60">
                                    {card.resolved.fields.map((field, i) => (
                                        <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                                            <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">
                                                {field.label}
                                            </span>
                                            <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                                <code className="min-w-0 break-all font-mono text-sm text-foreground">
                                                    {field.value}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 shrink-0"
                                                    onClick={() => copy(field.value, `field-${i}`)}
                                                    aria-label={`复制${field.label}`}
                                                >
                                                    {copiedId === `field-${i}` ? (
                                                        <Check className="size-4 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="size-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Button variant="secondary" className="w-full gap-2" onClick={() => copyAll(card)}>
                                    <Copy className="size-4" />
                                    复制全部
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4 px-4 pb-4">
                                <div className="rounded-lg border p-4">
                                    <code className="break-all font-mono text-sm text-foreground">
                                        {card.resolved.content}
                                    </code>
                                </div>
                                <Button variant="secondary" className="w-full gap-2" onClick={() => copyAll(card)}>
                                    <Copy className="size-4" />
                                    复制
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}
