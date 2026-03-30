import { Skeleton } from "@/components/ui/skeleton"

export default function AutoFetchLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-28" />
            </div>
        </div>
    )
}
