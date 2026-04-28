"use client"

import { useQuery } from "@tanstack/react-query"

export function usePendingWithdrawals() {
  const { data, isLoading } = useQuery<number>({
    queryKey: ["admin", "withdrawals", "pending-count"],
    queryFn: () =>
      fetch("/api/admin/withdrawals/count")
        .then((r) => r.json())
        .then((d) => d.pending as number),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  return { count: data ?? 0, isLoading }
}
