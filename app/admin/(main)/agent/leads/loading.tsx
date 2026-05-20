import { Skeleton } from "@/components/ui/skeleton"

export default function LeadsLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-96 w-full" />
        </div>
    )
}
