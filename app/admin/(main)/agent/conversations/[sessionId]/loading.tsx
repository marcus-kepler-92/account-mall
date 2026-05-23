import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ConversationDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Header — matches Back button + title + sessionId line */}
            <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-72" />
                </div>
            </div>

            {/* lg (not md) — admin sidebar eats ~250px; below lg the 2-col
                grid would squeeze messages to ~200px wide. Match real page. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] min-w-0">
                {/* Left: messages timeline */}
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-40" />
                    </CardHeader>
                    <CardContent className="space-y-5 min-w-0">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2 min-w-0">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-12" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <div className="pl-3 border-l-2 border-muted space-y-1.5 min-w-0">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Right: metadata + lead */}
                <div className="space-y-4 min-w-0">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-24" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-40" />
                                </div>
                            ))}
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="space-y-1.5">
                                        <Skeleton className="h-3 w-16" />
                                        <Skeleton className="h-4 w-12" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-24" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="space-y-1.5">
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-5 w-20" />
                            </div>
                            <div className="space-y-1.5">
                                <Skeleton className="h-3 w-12" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                            <Skeleton className="h-9 w-32" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
