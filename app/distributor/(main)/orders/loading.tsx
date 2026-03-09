import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorOrdersLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-40" />
            </div>

            <div className="flex flex-wrap items-center gap-4">
                <Skeleton className="h-10 w-full max-w-sm" />
                <Skeleton className="h-10 w-[140px]" />
                <Skeleton className="h-9 w-16" />
            </div>

            <div className="rounded-md border">
                <div className="flex items-center gap-4 bg-muted/50 px-4 h-10">
                    {[80, 100, 60, 60, 60, 100].map((w, i) => (
                        <Skeleton key={i} className="h-4" style={{ width: w }} />
                    ))}
                </div>
                {Array.from({ length: 6 }).map((_, row) => (
                    <div key={row} className="flex items-center gap-4 px-4 py-3 border-t">
                        {[80, 100, 60, 60, 60, 100].map((w, i) => (
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
