"use client"

import { useQuery } from "@tanstack/react-query"
import type { SourceKey, SourceResult } from "@/lib/admin-notifications"

type Response = { sources: SourceResult[] }

export function useAdminNotifications() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["admin", "notifications"],
    queryFn: () => fetch("/api/admin/notifications").then((r) => r.json()),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  const sources = data?.sources ?? []
  const byKey = Object.fromEntries(sources.map((s) => [s.key, s])) as Partial<
    Record<SourceKey, SourceResult>
  >
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0)

  return { sources, byKey, totalCount, isLoading }
}
