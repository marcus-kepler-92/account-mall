"use client"

import { useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { SourceKey, SourceResult } from "@/lib/admin-notifications"

type Response = { sources: SourceResult[] }

const QUERY_KEY = ["admin", "notifications"] as const

export function useAdminNotifications() {
  const { data, isLoading } = useQuery<Response>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/admin/notifications")
      if (!r.ok) throw new Error(`notifications fetch failed: ${r.status}`)
      return r.json()
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  // Memoize so consumers keyed off a stable reference don't recompute on unrelated renders.
  const sources = useMemo(() => data?.sources ?? [], [data?.sources])
  const byKey = useMemo(
    () =>
      Object.fromEntries(sources.map((s) => [s.key, s])) as Partial<
        Record<SourceKey, SourceResult>
      >,
    [sources],
  )
  const totalCount = sources.reduce((sum, s) => sum + s.count, 0)

  return { sources, byKey, totalCount, isLoading }
}

export type DismissItem = { sourceKey: SourceKey; itemId: string; fingerprint: string }

/** Optimistically drop `items` from the cached sources. Other sources are left untouched. */
function dropItemsFromCache(prev: Response | undefined, items: DismissItem[]): Response | undefined {
  if (!prev) return prev
  const idsBySource = new Map<SourceKey, Set<string>>()
  for (const it of items) {
    if (!idsBySource.has(it.sourceKey)) idsBySource.set(it.sourceKey, new Set())
    idsBySource.get(it.sourceKey)!.add(it.itemId)
  }
  return {
    sources: prev.sources.map((s) => {
      const dropIds = idsBySource.get(s.key)
      if (!dropIds || dropIds.size === 0) return s
      // `s.items` is a discriminated union; the filter shape is identical across variants.
      const next = (s.items as { id: string }[]).filter((it) => !dropIds.has(it.id))
      return { ...s, items: next, count: next.length } as SourceResult
    }),
  }
}

type DismissContext = { previous: Response | undefined }

/**
 * Mark items as read. Pass a single-item array for per-row swipe, or every item of a source
 * for the sidebar drag-to-dismiss-all interaction.
 */
export function useDismissAdminNotifications() {
  const queryClient = useQueryClient()

  return useMutation<{ ok: true; dismissed?: number }, Error, DismissItem[], DismissContext>({
    mutationFn: async (items) => {
      if (items.length === 0) return { ok: true, dismissed: 0 }
      const r = await fetch("/api/admin/notifications/dismiss-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!r.ok) throw new Error(`dismiss failed: ${r.status}`)
      return r.json() as Promise<{ ok: true; dismissed: number }>
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<Response>(QUERY_KEY)
      queryClient.setQueryData<Response | undefined>(QUERY_KEY, (prev) =>
        dropItemsFromCache(prev, items),
      )
      return { previous }
    },
    onError: (_err, _items, ctx) => {
      // Snapshot rollback — UI returns to pre-mutation state without waiting for refetch.
      if (ctx?.previous) queryClient.setQueryData(QUERY_KEY, ctx.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
