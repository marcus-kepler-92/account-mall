import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorCommissionsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-28 mb-2" />
                <Skeleton className="h-4 w-40" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-4 w-full max-w-sm" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-4 w-full max-w-md" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-28" />
                    <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex gap-4 px-4 h-10 bg-muted/50 rounded-md items-center">
                            {[80, 80, 60, 80].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                        {Array.from({ length: 4 }).map((_, row) => (
                            <div key={row} className="flex gap-4 px-4 py-3">
                                {[80, 80, 60, 80].map((w, i) => (
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
