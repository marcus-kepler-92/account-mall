import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorOrdersLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-1 border-b border-border">
                {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-9 w-16 rounded-t-md" />
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-28" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex gap-4 px-4 h-10 bg-muted/50 rounded-md items-center">
                            {[80, 100, 60, 60, 60, 80].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                        {Array.from({ length: 5 }).map((_, row) => (
                            <div key={row} className="flex gap-4 px-4 py-3">
                                {[80, 100, 60, 60, 60, 80].map((w, i) => (
                                    <Skeleton key={i} className="h-4" style={{ width: w }} />
                                ))}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
