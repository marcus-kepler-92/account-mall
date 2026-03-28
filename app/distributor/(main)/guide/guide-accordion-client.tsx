"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { GuideItem } from "./guide-accordion-list"

const SKELETON_WIDTHS = [160, 200, 140, 180, 120]

function AccordionListSkeleton() {
    return (
        <div className="divide-y">
            {SKELETON_WIDTHS.map((w, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-3">
                    <Skeleton className="h-4" style={{ width: w }} />
                    <Skeleton className="size-4 rounded" />
                </div>
            ))}
        </div>
    )
}

const GuideAccordionList = dynamic(
    () => import("./guide-accordion-list").then((m) => ({ default: m.GuideAccordionList })),
    { ssr: false, loading: AccordionListSkeleton }
)

export function GuideAccordionClient({ guides }: { guides: GuideItem[] }) {
    return <GuideAccordionList guides={guides} />
}
