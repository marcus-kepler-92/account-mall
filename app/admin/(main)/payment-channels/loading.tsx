import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingPaymentChannels() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-16 w-64" />
            <div className="grid gap-4 grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                ))}
            </div>
            <Skeleton className="h-64" />
        </div>
    )
}
