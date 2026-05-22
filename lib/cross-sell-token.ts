import { createHmac, timingSafeEqual } from "crypto"
import { config } from "@/lib/config"

function getSecret(): string | null {
    const secret = config.crossSellTokenSecret ?? config.betterAuthSecret
    if (!secret || secret.length < 16) return null
    return secret
}

function base64UrlEncode(buf: Buffer): string {
    return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(str: string): Buffer {
    let b64 = str.replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4
    if (pad) b64 += "=".repeat(4 - pad)
    return Buffer.from(b64, "base64")
}

export type CsTokenPayload = {
    sourceOrderId: string
    exp: number
}

/**
 * Generate a short-lived HMAC-SHA256 cs token bound to a source order.
 *
 * Token format: `${expiry}.${base64url(sourceOrderId)}.${base64url(hmac)}`
 * HMAC message: `${sourceOrderId}\n${expiry}`
 *
 * The token carries only `sourceOrderId` (not a specific target product).
 * Eligible target products and discount percent are resolved server-side at
 * read time via `resolveCrossSellDiscount`, so the same token works for any
 * eligible cross-sell target while the session is alive.
 *
 * Returns null if CROSS_SELL_TOKEN_SECRET / BETTER_AUTH_SECRET not set or shorter than 16 chars.
 */
export function generateCsToken(
    sourceOrderId: string,
    ttlMs: number,
): string | null {
    const secret = getSecret()
    if (!secret) return null
    const expiry = String(Date.now() + ttlMs)
    const message = `${sourceOrderId}\n${expiry}`
    const hmac = createHmac("sha256", secret).update(message).digest()
    const payloadEncoded = base64UrlEncode(Buffer.from(sourceOrderId, "utf8"))
    return `${expiry}.${payloadEncoded}.${base64UrlEncode(hmac)}`
}

/**
 * Verify a cs token. Returns `{ valid: true, payload }` for a non-expired,
 * untampered token, `{ valid: false }` otherwise. Uses timingSafeEqual.
 */
export function verifyCsToken(token: string): {
    valid: boolean
    payload?: CsTokenPayload
} {
    try {
        const secret = getSecret()
        if (!secret) return { valid: false }

        const parts = token.split(".")
        if (parts.length !== 3) return { valid: false }
        const [expiryStr, payloadEncoded, sigB64] = parts
        if (!expiryStr || !payloadEncoded || !sigB64) return { valid: false }

        const expiry = Number(expiryStr)
        if (Number.isNaN(expiry) || Date.now() > expiry) return { valid: false }

        const sourceOrderId = base64UrlDecode(payloadEncoded).toString("utf8")
        if (!sourceOrderId) return { valid: false }

        const message = `${sourceOrderId}\n${expiryStr}`
        const expected = createHmac("sha256", secret).update(message).digest()
        const received = base64UrlDecode(sigB64)
        if (expected.length !== received.length) return { valid: false }
        if (!timingSafeEqual(expected, received)) return { valid: false }

        return { valid: true, payload: { sourceOrderId, exp: expiry } }
    } catch {
        return { valid: false }
    }
}
