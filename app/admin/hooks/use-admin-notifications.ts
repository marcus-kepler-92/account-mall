"use client"

import { useQuery } from "@tanstack/react-query"
import type { SourceKey, SourceResult } from "@/lib/admin-notifications"

type Response = { sources: SourceResult[] }

export function useAdminNotifications() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: ["admin", "notifications"],
    queryFn: async () => {
      const r = await fetch("/api/admin/notifications")
      if (!r.ok) throw new Error(`notifications fetch failed: ${r.status}`)
      return r.json()
    },
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
