import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function KnowledgeEditLoading() {
    return (
        <div className="space-y-6">
            {/* Header — back btn + title h2 + description p */}
            <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="space-y-2">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-64" />
                </div>
            </div>

            {/* Card "知识内容" with title, content editor (tall), tags — in that order */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-20" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    {/* Content (MarkdownEditor h=360) */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-[360px] w-full" />
                        <Skeleton className="h-3 w-64" />
                    </div>
                    {/* Tags */}
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-9 w-full" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </CardContent>
            </Card>

            {/* Action buttons OUTSIDE the card (Save + Cancel) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
            </div>
        </div>
    )
}
