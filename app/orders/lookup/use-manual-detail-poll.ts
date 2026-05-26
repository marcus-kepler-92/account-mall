"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
    MANUAL_DETAIL_POLL_INTERVAL_MS,
    MANUAL_FULFILLMENT_POLL_MAX_DURATION_MS,
} from "@/lib/constants/manual-fulfillment-poll"
import type { OrderResult } from "./types"

type Phase = "polling" | "fulfilled" | "closed" | "stopped_timeout"

type Args = {
    orderNo: string
    /** Reader for the cached password set by the lookup flow. Returns null
     * if buyer hasn't verified or sessionStorage was cleared — caller can
     * decide to suppress polling in that case. */
    getPassword: () => string | null
    /** Optional; defaults to true when password is available. */
    enabled?: boolean
}

/**
 * Lookup-Sheet poller for MANUAL orders awaiting fulfillment. Hits
 * POST /api/orders/lookup with the buyer's cached password so the
 * response includes the full detail (cards + fulfillment) once admin
 * ships. Cadence is 60s (vs 30s for the token-based hook) because each
 * call runs scrypt server-side. Visibility-aware; capped at 30 minutes.
 *
 * Render stays pure: the timeout cap is enforced inside the
 * `refetchInterval` callback (not render) and committed to React state.
 */
export function useManualDetailPoll(args: Args): {
    refreshed: OrderResult | null
    phase: Phase
} {
    const startedAtRef = useRef<number | null>(null)
    useEffect(() => {
        if (startedAtRef.current === null) startedAtRef.current = Date.now()
    }, [])
    const [timedOut, setTimedOut] = useState(false)

    const password = args.getPassword()
    const requested = args.enabled !== false && !!password

    const { data } = useQuery<OrderResult | null>({
        queryKey: ["manual-detail-poll", args.orderNo],
        enabled: requested,
        queryFn: async () => {
            const r = await fetch("/api/orders/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderNo: args.orderNo, password }),
                cache: "no-store",
            })
            if (!r.ok) return null
            return r.json()
        },
        refetchInterval: (query) => {
            const cached = query.state.data as OrderResult | null | undefined
            const s = cached?.status
            if (s === "COMPLETED" || s === "CLOSED") return false
            const startedAt = startedAtRef.current
            if (
                startedAt !== null &&
                Date.now() - startedAt > MANUAL_FULFILLMENT_POLL_MAX_DURATION_MS
            ) {
                setTimedOut(true)
                return false
            }
            return MANUAL_DETAIL_POLL_INTERVAL_MS
        },
        refetchIntervalInBackground: false,
        staleTime: 0,
        retry: false,
    })

    const status = data?.status ?? null
    let phase: Phase = "polling"
    if (status === "COMPLETED") phase = "fulfilled"
    else if (status === "CLOSED") phase = "closed"
    else if (timedOut) phase = "stopped_timeout"

    return { refreshed: data ?? null, phase }
}
