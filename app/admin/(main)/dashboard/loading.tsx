import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

const cardGrid = "grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-[repeat(2,minmax(0,1fr))]"

function PanelSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-32" />
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-7 w-12 rounded-md" />
            ))}
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-4 w-3" />
            <Skeleton className="h-7 w-36 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <header>
        <Skeleton className="h-8 w-24 sm:h-9" />
        <Skeleton className="mt-2 h-4 w-48 sm:w-64" />
      </header>

      {/* SalesPanel */}
      <section className="min-w-0">
        <Skeleton className="mb-3 h-3.5 w-16" />
        <PanelSkeleton />
      </section>

      {/* DistributorPanel */}
      <section className="min-w-0">
        <Skeleton className="mb-3 h-3.5 w-20" />
        <PanelSkeleton />
      </section>

      {/* 趋势 + 商品表现 */}
      <section className={`min-w-0 ${cardGrid}`}>
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-5 w-32 sm:h-6" />
            <Skeleton className="mt-1 h-4 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full sm:h-[280px]" />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-5 w-28 sm:h-6" />
            <Skeleton className="mt-1 h-4 w-16" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] w-full sm:h-[240px]" />
          </CardContent>
        </Card>
      </section>

      {/* 库存预警 + 待通知补货 */}
      <section className={`min-w-0 ${cardGrid}`}>
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-5 w-20 sm:h-6" />
            <Skeleton className="mt-1 h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] w-full sm:h-[240px]" />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-5 w-28 sm:h-6" />
            <Skeleton className="mt-1 h-4 w-24" />
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

      {/* 最近订单（全宽） */}
      <section className="min-w-0">
        <Card className="min-w-0">
          <CardHeader>
            <Skeleton className="h-5 w-20 sm:h-6" />
            <Skeleton className="mt-1 h-4 w-24" />
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
      </section>
    </div>
  )
}
