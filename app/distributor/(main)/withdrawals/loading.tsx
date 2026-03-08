import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorWithdrawalsLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-36" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex gap-4 px-4 h-10 bg-muted/50 rounded-md items-center">
                            {[60, 80, 80, 80, 120].map((w, i) => (
                                <Skeleton key={i} className="h-4" style={{ width: w }} />
                            ))}
                        </div>
                        {Array.from({ length: 4 }).map((_, row) => (
                            <div key={row} className="flex gap-4 px-4 py-3">
                                {[60, 80, 80, 80, 120].map((w, i) => (
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
