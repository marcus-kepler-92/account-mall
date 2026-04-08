import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function Loading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-9 w-32" />
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-8">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-6 w-24" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
