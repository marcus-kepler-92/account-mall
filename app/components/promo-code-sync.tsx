"use client"

import { Suspense } from "react"
import { useSyncPromoCodeToCookie } from "@/app/hooks/use-sync-promo-code-to-cookie"

function PromoCodeSyncInner() {
    useSyncPromoCodeToCookie()
    return null
}

/**
 * Renders nothing; syncs URL promoCode to cookie when present.
 * Mount in root layout so it runs on every storefront page.
 */
export function PromoCodeSync() {
    return (
        <Suspense fallback={null}>
            <PromoCodeSyncInner />
        </Suspense>
    )
}
