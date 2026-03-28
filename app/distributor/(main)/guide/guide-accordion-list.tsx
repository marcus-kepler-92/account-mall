"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { GuideMarkdownView } from "./guide-markdown-view"

export type GuideItem = {
    id: string
    title: string
    content: string | null
    tagName: string | null
}

type GuideAccordionListProps = {
    guides: GuideItem[]
}

export function GuideAccordionList({ guides }: GuideAccordionListProps) {
    const [openId, setOpenId] = useState<string | null>(null)

    return (
        <ul className="divide-y">
            {guides.map((guide) => {
                const isOpen = openId === guide.id
                return (
                    <li key={guide.id}>
                        <Collapsible
                            className="group"
                            open={isOpen}
                            onOpenChange={(open) => setOpenId(open ? guide.id : null)}
                        >
                            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40">
                                <span className="font-medium text-foreground">{guide.title}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                    {guide.tagName && (
                                        <Badge variant="outline" className="hidden sm:inline-flex">
                                            {guide.tagName}
                                        </Badge>
                                    )}
                                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="border-t px-5 py-4">
                                    {guide.tagName && (
                                        <Badge variant="outline" className="mb-3 sm:hidden">
                                            {guide.tagName}
                                        </Badge>
                                    )}
                                    <GuideMarkdownView content={guide.content ?? ""} />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </li>
                )
            })}
        </ul>
    )
}
