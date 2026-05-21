"use client"

import { useQuery } from "@tanstack/react-query"

// Mirror of usePendingWithdrawals — drives the "人工跟进" sidebar badge.
// Counts AgentLeads in actionable states (NEW + CONTACTED), matching
// the leads page's default 主待办 filter so the badge stays in sync
// with what ops sees on click-through.
export function usePendingLeads() {
  const { data, isLoading } = useQuery<number>({
    queryKey: ["admin", "agent-leads", "pending-count"],
    queryFn: () =>
      fetch("/api/admin/agent/leads/count")
        .then((r) => r.json())
        .then((d) => (typeof d.pending === "number" ? d.pending : 0)),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  return { count: data ?? 0, isLoading }
}
