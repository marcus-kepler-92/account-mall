import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorCommissionsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-64" />
            </div>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-full" />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-64 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-4 w-32" />
                </CardContent>
            </Card>

            <div>
                <Skeleton className="h-5 w-20 mb-2" />
                <Skeleton className="h-4 w-40 mb-4" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-9 w-16" />
            </div>
            <div className="rounded-md border">
                <div className="flex items-center gap-4 bg-muted/50 px-4 h-10">
                    {[80, 80, 60, 100].map((w, i) => (
                        <Skeleton key={i} className="h-4" style={{ width: w }} />
                    ))}
                </div>
                {Array.from({ length: 5 }).map((_, row) => (
                    <div key={row} className="flex items-center gap-4 px-4 py-3 border-t">
                        {[80, 80, 60, 100].map((w, i) => (
                            <Skeleton key={i} className="h-4" style={{ width: w }} />
                        ))}
                    </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 border-t">
                    <Skeleton className="h-4 w-24" />
                    <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="size-8 rounded-md" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
