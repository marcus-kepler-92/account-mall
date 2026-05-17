"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

export const DashboardTopProductsChart = dynamic(
  () => import("./dashboard-top-products-chart").then((m) => m.DashboardTopProductsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px] w-full" /> }
)
