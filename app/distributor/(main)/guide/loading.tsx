import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const TITLE_WIDTHS = [160, 200, 140, 180, 120, 170]
const BADGE_WIDTHS = [36, 48, 40]

export default function DistributorGuideLoading() {
    return (
        <div className="space-y-6">
            <div>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-5 w-64" />
            </div>

            {/* category filter badges */}
            <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-10 rounded-full" />
                {BADGE_WIDTHS.map((w, i) => (
                    <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
                ))}
            </div>

            {/* accordion list card */}
            <Card>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {TITLE_WIDTHS.map((w, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-3.5 gap-3">
                                <Skeleton className="h-4" style={{ width: w }} />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="hidden sm:block h-5 w-10 rounded-full" />
                                    <Skeleton className="size-4 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
