"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
    MANUAL_FULFILLMENT_POLL_MAX_DURATION_MS,
    MANUAL_STATUS_POLL_INTERVAL_MS,
} from "@/lib/constants/manual-fulfillment-poll"

type Status =
    | "PENDING"
    | "AWAITING_FULFILLMENT"
    | "PROCESSING"
    | "COMPLETED"
    | "CLOSED"

type Phase = "polling" | "fulfilled" | "closed" | "stopped_timeout"

type Options = {
    /** When false, the hook is paused (no polls, no work). Defaults to true. */
    enabled?: boolean
}

/**
 * Lightweight buyer-side poller for MANUAL orders sitting in
 * AWAITING_FULFILLMENT / PROCESSING. Uses the token-gated, status-only
 * /api/orders/[orderNo]/payment-status endpoint (no scrypt — safe to poll
 * at 30s cadence). Visibility-aware (refetchIntervalInBackground: false)
 * so hidden tabs don't burn server cycles. Stops automatically after the
 * 30-minute zombie-tab cap.
 *
 * Render stays pure: the timeout cap is enforced inside the
 * `refetchInterval` callback (not render) and committed to React state
 * via `setTimedOut(true)` so re-render picks it up.
 */
export function useManualStatusPoll(
    orderNo: string,
    token: string | null,
    opts: Options = {},
): { status: Status | null; phase: Phase } {
    // Lazy-init in effect to keep render pure (react-hooks/purity).
    const startedAtRef = useRef<number | null>(null)
    useEffect(() => {
        if (startedAtRef.current === null) startedAtRef.current = Date.now()
    }, [])
    const [timedOut, setTimedOut] = useState(false)

    const requested = opts.enabled !== false && !!token

    const { data } = useQuery<{ status: Status } | null>({
        queryKey: ["manual-status-poll", orderNo],
        enabled: requested,
        queryFn: async () => {
            const r = await fetch(
                `/api/orders/${encodeURIComponent(orderNo)}/payment-status?token=${encodeURIComponent(token!)}`,
                { cache: "no-store" },
            )
            if (!r.ok) return null
            return r.json()
        },
        refetchInterval: (query) => {
            // Outside render — safe to call Date.now() and setState.
            const cached = query.state.data as { status: Status } | null | undefined
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
            return MANUAL_STATUS_POLL_INTERVAL_MS
        },
        refetchIntervalInBackground: false, // visibility-aware: pause when tab hidden
        staleTime: 0,
        retry: false,
    })

    const status = data?.status ?? null
    let phase: Phase = "polling"
    if (status === "COMPLETED") phase = "fulfilled"
    else if (status === "CLOSED") phase = "closed"
    else if (timedOut) phase = "stopped_timeout"

    return { status, phase }
}
