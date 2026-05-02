"use client"

import { useState } from "react"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { MarkdownViewClient } from "@/app/components/markdown-view-client"
import { useEffect } from "react"

type AnnouncementItem = {
    id: string
    title: string
    content: string | null
    publishedAt: string | null
    isMandatory: boolean
    hasRead: boolean
}

function ContentSkeleton() {
    const widths = ["w-full", "w-4/5", "w-3/4"]
    return (
        <div className="space-y-2 py-1">
            {widths.map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
        </div>
    )
}

function CollapsibleMarkdownContent({ content }: { content: string }) {
    const [showSkeleton, setShowSkeleton] = useState(true)
    useEffect(() => {
        const t = setTimeout(() => setShowSkeleton(false), 400)
        return () => clearTimeout(t)
    }, [])
    return showSkeleton ? <ContentSkeleton /> : <MarkdownViewClient content={content} />
}

export function AnnouncementsListClient({ announcements }: { announcements: AnnouncementItem[] }) {
    const [expandedIds, setExpandedIds] = useState<string[]>([])

    const toggleExpanded = (id: string, open: boolean) => {
        setExpandedIds((prev) =>
            open ? [...prev, id] : prev.filter((x) => x !== id),
        )
    }

    return (
        <ul className="space-y-3">
            {announcements.map((a) => {
                const hasContent = !!a.content?.trim()
                const open = expandedIds.includes(a.id)

                return (
                    <li
                        key={a.id}
                        className={cn(
                            "rounded-lg border bg-muted/50 shadow-sm transition-shadow hover:shadow",
                            "animate-in fade-in duration-200",
                        )}
                    >
                        {hasContent ? (
                            <Collapsible
                                className="group"
                                open={open}
                                onOpenChange={(openState) => toggleExpanded(a.id, openState)}
                            >
                                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-foreground truncate">{a.title}</span>
                                        {a.isMandatory && (
                                            <Badge variant="destructive" className="shrink-0 text-xs">必读</Badge>
                                        )}
                                        {a.hasRead && (
                                            <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">已读</Badge>
                                        )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {a.publishedAt && (
                                            <span className="text-xs text-muted-foreground">{formatDate(a.publishedAt)}</span>
                                        )}
                                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="border-t border-border bg-card px-8 py-3 text-sm text-muted-foreground rounded-b-lg">
                                        <CollapsibleMarkdownContent content={a.content!} />
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ) : (
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-medium text-foreground truncate">{a.title}</span>
                                    {a.isMandatory && (
                                        <Badge variant="destructive" className="shrink-0 text-xs">必读</Badge>
                                    )}
                                    {a.hasRead && (
                                        <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">已读</Badge>
                                    )}
                                </div>
                                {a.publishedAt && (
                                    <span className="text-xs text-muted-foreground shrink-0">{formatDate(a.publishedAt)}</span>
                                )}
                            </div>
                        )}
                    </li>
                )
            })}
        </ul>
    )
}
