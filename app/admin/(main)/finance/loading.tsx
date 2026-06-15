import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function FinanceLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="border-l-4">
                        <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-7 w-24" />
                                </div>
                                <Skeleton className="size-8 rounded-full" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-8 w-28" />
                </div>
                <Skeleton className="h-[300px] w-full" />
            </div>
        </div>
    )
}
