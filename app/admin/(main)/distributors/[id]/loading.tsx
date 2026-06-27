import { Skeleton } from "@/components/ui/skeleton"

export default function DistributorDetailLoading() {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-64" />
            </div>
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-[420px] w-full" />
        </div>
    )
}
