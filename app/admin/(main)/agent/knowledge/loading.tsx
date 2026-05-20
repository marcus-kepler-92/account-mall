import { Skeleton } from "@/components/ui/skeleton"

export default function KnowledgeLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-64 w-full" />
        </div>
    )
}
