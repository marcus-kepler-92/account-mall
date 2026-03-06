"use client"

import { useState, useEffect } from "react"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductDescriptionViewClient } from "@/app/components/product-description-view-client"

const STORAGE_KEY = "announcements-expanded"

export type FrontAnnouncement = {
    id: string
    title: string
    content: string | null
    publishedAt: string | null
}

type AnnouncementsBlockProps = {
    announcements: FrontAnnouncement[]
}

function formatDate(iso: string | null) {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    })
}

function getDefaultExpandedId(announcements: FrontAnnouncement[]): string | null {
    const firstWithContent = announcements.find((x) => x.content?.trim())
    return firstWithContent?.id ?? null
}

export function AnnouncementsBlock({ announcements }: AnnouncementsBlockProps) {
    const [expandedIds, setExpandedIds] = useState<string[]>([])
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (raw) {
                const parsed = JSON.parse(raw) as unknown
                if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
                    setExpandedIds(parsed)
                    setHydrated(true)
                    return
                }
            }
        } catch {
            // ignore
        }
        const defaultId = getDefaultExpandedId(announcements)
        setExpandedIds(defaultId ? [defaultId] : [])
        setHydrated(true)
    }, [announcements])

    const setExpanded = (id: string, open: boolean) => {
        setExpandedIds((prev) => {
            const next = open
                ? prev.includes(id)
                    ? prev
                    : [...prev, id]
                : prev.filter((x) => x !== id)
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
            } catch {
                // ignore
            }
            return next
        })
    }

    if (!announcements.length) return null

    return (
        <section
            className="mb-10 animate-in fade-in duration-300"
            aria-label="站内公告"
        >
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold tracking-tight">
                <Megaphone className="size-5 text-primary" aria-hidden />
                公告
            </h2>
            <ul className="space-y-3">
                {announcements.map((a, index) => {
                    const hasContent = !!a.content?.trim()
                    const isHighestPriorityWithContent =
                        hasContent &&
                        index === announcements.findIndex((x) => x.content?.trim())
                    // Before hydration: default (first with content open). After: use stored state.
                    const open = hydrated ? expandedIds.includes(a.id) : isHighestPriorityWithContent
                    return (
                        <li
                            key={a.id}
                            className={cn(
                                "rounded-lg border bg-muted/50 shadow-sm transition-shadow hover:shadow",
                                "animate-in fade-in duration-200"
                            )}
                        >
                            {hasContent ? (
                                <Collapsible
                                    className="group"
                                    open={open}
                                    onOpenChange={(openState) => setExpanded(a.id, openState)}
                                >
                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors">
                                        <span className="font-medium text-foreground">
                                            {a.title}
                                        </span>
                                        <div className="flex shrink-0 items-center gap-2">
                                            {a.publishedAt && (
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(a.publishedAt)}
                                                </span>
                                            )}
                                            <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="border-t border-border bg-card px-8 py-3 text-sm text-muted-foreground rounded-b-lg">
                                            <ProductDescriptionViewClient description={a.content!} />
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ) : (
                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="font-medium text-foreground">
                                        {a.title}
                                    </span>
                                    {a.publishedAt && (
                                        <span className="text-xs text-muted-foreground shrink-0">
                                            {formatDate(a.publishedAt)}
                                        </span>
                                    )}
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}
