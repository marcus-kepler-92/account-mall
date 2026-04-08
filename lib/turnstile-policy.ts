import { config } from "@/lib/config"

/**
 * Whether Turnstile should be shown and verified for public storefront orders.
 * Vercel preview uses production NODE_ENV but preview hostnames often fail Turnstile
 * when keys are scoped to the production domain.
 */
export function isStorefrontTurnstileEnforced(): boolean {
    if (config.nodeEnv === "development") return false
    if (process.env.VERCEL_ENV === "preview") return false
    return true
}
