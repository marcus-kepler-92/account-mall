import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const sectionGap = "space-y-6 sm:space-y-8"
const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"
const kpiGrid =
    "grid grid-cols-1 gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]"

export default function DashboardLoading() {
    return (
        <div className={sectionGap}>
            <header>
                <Skeleton className="h-8 w-24 sm:h-9" />
                <Skeleton className="mt-2 h-4 w-48 sm:w-64" />
            </header>

            <section className="min-w-0">
                <div className={kpiGrid}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i} className="min-w-0">
                            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                                <Skeleton className="h-4 min-w-0 flex-1" />
                                <Skeleton className="size-4 shrink-0 rounded" />
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="mb-2 h-7 w-16 sm:h-8" />
                                <Skeleton className="h-4 w-20" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>

            <section className={`min-w-0 ${cardGrid}`}>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-32 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-40" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[260px] w-full sm:h-[280px]" />
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-28 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-36" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[220px] w-full sm:h-[240px]" />
                    </CardContent>
                </Card>
            </section>

            <section className={`min-w-0 ${cardGrid}`}>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-36 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-[220px] w-full sm:h-[240px]" />
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-20 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-40" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className={`min-w-0 ${cardGrid}`}>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-24 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-28" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} className="h-12 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
                <Card className="min-w-0">
                    <CardHeader>
                        <Skeleton className="h-5 w-28 sm:h-6" />
                        <Skeleton className="mt-1 h-4 w-36" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-10 w-full" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </section>
        </div>
    )
}
