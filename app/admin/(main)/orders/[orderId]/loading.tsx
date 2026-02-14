import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrderDetailLoading() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-md" />
                <div className="flex-1">
                    <Skeleton className="h-8 w-48 mb-2" />
                    <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            {/* Order info card */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-24" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="space-y-1">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="h-5 w-32" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Cards table card */}
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <div className="flex items-center gap-4 bg-muted/50 px-4 h-10">
                            {[120, 60, 100, 80].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                        {Array.from({ length: 4 }).map((_, row) => (
                            <div
                                key={row}
                                className="flex items-center gap-4 px-4 py-3 border-t"
                            >
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-12 rounded-full" />
                                <Skeleton className="h-4 w-28 ml-auto" />
                                <Skeleton className="size-8 rounded" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
