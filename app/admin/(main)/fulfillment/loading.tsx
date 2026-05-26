import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function FulfillmentLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-28 mb-2" />
                <Skeleton className="h-5 w-64" />
            </div>

            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
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

            <Card>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <Skeleton className="h-4 w-32" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-[140px]" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                </div>
                <div className="p-0">
                    <div className="flex items-center gap-4 bg-muted/50 px-4 h-10">
                        {[80, 120, 100, 60, 60, 40, 60, 80].map((w, i) => (
                            <Skeleton key={i} className="h-4" style={{ width: w }} />
                        ))}
                    </div>
                    {Array.from({ length: 6 }).map((_, row) => (
                        <div key={row} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
                            {[80, 120, 100, 60, 60, 40, 60, 80].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    )
}
