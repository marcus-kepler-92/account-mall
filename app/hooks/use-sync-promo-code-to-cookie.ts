"use client"

import { useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { configClient } from "@/lib/config-client"

/**
 * Global hook: when promoCode exists in URL (and is valid), sync it to cookie via API.
 * Call this in a client component that mounts on storefront pages (e.g. root layout wrapper).
 */
export function useSyncPromoCodeToCookie() {
    const searchParams = useSearchParams()
    const lastSynced = useRef<string | null>(null)

    useEffect(() => {
        const promoCode = searchParams.get("promoCode")?.trim()
        if (!promoCode || promoCode.length < 1 || promoCode.length > configClient.promoCodeMaxLength) {
            return
        }
        if (lastSynced.current === promoCode) {
            return
        }
        lastSynced.current = promoCode
        fetch(`/api/set-promo-cookie?promoCode=${encodeURIComponent(promoCode)}`, {
            method: "GET",
            credentials: "same-origin",
        }).catch(() => {
            lastSynced.current = null
        })
    }, [searchParams])
}
