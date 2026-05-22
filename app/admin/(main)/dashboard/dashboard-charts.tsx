"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export const DashboardTopProductsChart = dynamic(
  () => import("./dashboard-top-products-chart").then((m) => m.DashboardTopProductsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

export const DashboardProfitTrendChart = dynamic(
  () => import("./dashboard-profit-trend-chart").then((m) => m.DashboardProfitTrendChart),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
)
