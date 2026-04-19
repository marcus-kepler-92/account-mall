"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export const DashboardTrendSection = dynamic(
  () => import("./dashboard-trend-section").then((m) => m.DashboardTrendSection),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)

export const DashboardTopProductsChart = dynamic(
  () => import("./dashboard-top-products-chart").then((m) => m.DashboardTopProductsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)
