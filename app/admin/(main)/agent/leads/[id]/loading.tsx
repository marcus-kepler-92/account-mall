import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export default function LeadDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Header — Back + title + lead id + status badge */}
            <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-6 w-16 shrink-0" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] min-w-0">
                {/* Left: conversation window */}
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-48" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-12" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <div className="pl-3 border-l-2 border-muted space-y-1.5">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-5/6" />
                                    <Skeleton className="h-4 w-2/3" />
                                </div>
                            </div>
                        ))}
                        <Separator />
                        <Skeleton className="h-9 w-36" />
                    </CardContent>
                </Card>

                {/* Right: metadata + status form */}
                <div className="space-y-4 min-w-0">
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-20" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-40" />
                                </div>
                            ))}
                            <Separator />
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div key={i} className="space-y-1.5">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            ))}
                            <Separator />
                            <div className="space-y-1.5">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                            <div className="space-y-1.5">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-4 w-12" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-20" />
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-9 w-24" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
