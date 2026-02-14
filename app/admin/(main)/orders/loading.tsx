import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrdersLoading() {
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-40" />
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border-l-4 border-l-muted">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Skeleton className="h-4 w-12 mb-2" />
                                    <Skeleton className="h-8 w-16" />
                                </div>
                                <Skeleton className="size-8 rounded" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-16" />
            </div>

            {/* Table card */}
            <Card>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <Skeleton className="h-4 w-32" />
                </div>
                <div className="p-0">
                    <div className="flex items-center gap-4 bg-muted/50 px-4 h-10">
                        {[80, 100, 120, 50, 60, 60, 60, 100].map((w, i) => (
                            <Skeleton key={i} className="h-4" style={{ width: w }} />
                        ))}
                    </div>
                    {Array.from({ length: 6 }).map((_, row) => (
                        <div key={row} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                            {[80, 100, 120, 50, 60, 60, 60, 100].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <Skeleton key={i} className="size-8 rounded-md" />
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    )
}
