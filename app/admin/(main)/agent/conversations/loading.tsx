import { Skeleton } from "@/components/ui/skeleton"

export default function ConversationsLoading() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-96 w-full" />
        </div>
    )
}
