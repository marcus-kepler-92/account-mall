import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function OrdersLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-5 w-40" />
            </div>
            <div className="max-w-sm">
                <Skeleton className="h-10 w-full" />
            </div>
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                    <Skeleton className="size-16 rounded-full mb-4" />
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </CardContent>
            </Card>
        </div>
    )
}
