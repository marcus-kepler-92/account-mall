"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeft, ChevronRight, Megaphone } from "lucide-react"
import { formatDate } from "@/lib/utils"

type MandatoryAnnouncement = {
    id: string
    title: string
    content: string | null
    publishedAt: string | null
    isMandatory: boolean
    hasRead: boolean
}

function ContentSkeleton() {
    const widths = ["w-full", "w-4/5", "w-3/4", "w-full", "w-2/3"]
    return (
        <div className="space-y-2 py-1">
            {widths.map((w, i) => (
                <Skeleton key={i} className={`h-4 ${w}`} />
            ))}
        </div>
    )
}

const MarkdownView = dynamic(
    () => import("@/app/components/markdown-view").then((m) => m.MarkdownView),
    { ssr: false, loading: () => <ContentSkeleton /> },
)

async function fetchUnreadMandatory(): Promise<MandatoryAnnouncement[]> {
    const res = await fetch("/api/distributor/announcements?unread=true&mandatory=true")
    if (!res.ok) throw new Error("Failed to fetch announcements")
    const json = await res.json()
    return (json.data ?? []) as MandatoryAnnouncement[]
}

async function ackAnnouncement(id: string): Promise<void> {
    await fetch(`/api/distributor/announcements/${id}/ack`, { method: "POST" })
}

export function DistributorMandatoryAnnouncements() {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(true)
    const [currentIndex, setCurrentIndex] = useState(0)

    const { data: announcements = [] } = useQuery({
        queryKey: ["distributor-announcements", "mandatory-unread"],
        queryFn: fetchUnreadMandatory,
        staleTime: 5 * 60 * 1000,
    })

    const { mutate: markRead } = useMutation({ mutationFn: ackAnnouncement })

    if (!open || !announcements.length) return null

    const total = announcements.length
    const safeIndex = Math.min(currentIndex, total - 1)
    const current = announcements[safeIndex]

    const handleClose = () => {
        announcements.forEach((a) => markRead(a.id))
        queryClient.invalidateQueries({ queryKey: ["distributor-announcements"] })
        setOpen(false)
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) handleClose()
            }}
        >
            <DialogContent
                className="max-w-lg"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 pr-8">
                        <Megaphone className="size-4 text-primary shrink-0" aria-hidden />
                        {current.title}
                    </DialogTitle>
                    {current.publishedAt && (
                        <DialogDescription>{formatDate(current.publishedAt)}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="max-h-96 overflow-y-auto text-sm">
                    {current.content?.trim() ? (
                        <MarkdownView key={current.id} content={current.content} />
                    ) : (
                        <p className="text-muted-foreground text-center py-4">此公告无详细内容</p>
                    )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                    {total > 1 ? (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={safeIndex === 0}
                                onClick={() => setCurrentIndex((i) => i - 1)}
                                aria-label="上一条公告"
                            >
                                <ChevronLeft className="size-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                {safeIndex + 1} / {total}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={safeIndex === total - 1}
                                    onClick={() => setCurrentIndex((i) => i + 1)}
                                    aria-label="下一条公告"
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                                {safeIndex === total - 1 && (
                                    <Button size="sm" onClick={handleClose}>
                                        我已阅读
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex justify-end">
                            <Button size="sm" onClick={handleClose}>
                                我已阅读
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
