/**
 * Per-tab sessionStorage cache for the buyer's lookup password.
 *
 * Buyers typically reuse one password across all their orders. When the
 * buyer successfully opens detail for one row we cache (email, password)
 * — subsequent rows can skip the password Dialog and just hit the detail
 * API directly. Cleared on 「换邮箱」 or mode switch.
 *
 * Extracted so non-page consumers (e.g. order-detail-content's polling
 * hook) can read the same cache without duplicating the key.
 */

const PASSWORD_CACHE_KEY = "account-mall-lookup-pw-cache"

export function readLookupPasswordCache(email: string): string | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.sessionStorage.getItem(PASSWORD_CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { email?: string; password?: string }
        if (parsed.email === email && typeof parsed.password === "string") {
            return parsed.password
        }
        return null
    } catch {
        return null
    }
}

export function writeLookupPasswordCache(email: string, password: string): void {
    if (typeof window === "undefined") return
    try {
        window.sessionStorage.setItem(
            PASSWORD_CACHE_KEY,
            JSON.stringify({ email, password }),
        )
    } catch {
        // sessionStorage may be unavailable (privacy mode) — silently skip.
    }
}

export function clearLookupPasswordCache(): void {
    if (typeof window === "undefined") return
    try {
        window.sessionStorage.removeItem(PASSWORD_CACHE_KEY)
    } catch {
        // ignore
    }
}
