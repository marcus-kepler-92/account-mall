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

export type CrossSellTokenPayload = {
    sourceOrderId: string
    targetProductId: string
    discountPercent: number
    exp: number
}

/**
 * Generate a short-lived HMAC-SHA256 token for a cross-sell discount offer.
 *
 * Token format: `${expiry}.${base64url(payloadJson)}.${base64url(hmac)}`
 * HMAC message: `${sourceOrderId}\n${targetProductId}\n${discountPercent}\n${expiry}`
 *
 * Returns null if CROSS_SELL_TOKEN_SECRET / BETTER_AUTH_SECRET not set or shorter than 16 chars.
 */
export function generateCrossSellToken(
    payload: {
        sourceOrderId: string
        targetProductId: string
        discountPercent: number
    },
    ttlMs: number,
): string | null {
    const secret = getSecret()
    if (!secret) return null
    const expiry = String(Date.now() + ttlMs)
    const payloadStr = `${payload.sourceOrderId}\n${payload.targetProductId}\n${payload.discountPercent}`
    const message = `${payloadStr}\n${expiry}`
    const hmac = createHmac("sha256", secret).update(message).digest()
    const payloadEncoded = base64UrlEncode(Buffer.from(payloadStr, "utf8"))
    return `${expiry}.${payloadEncoded}.${base64UrlEncode(hmac)}`
}

/**
 * Verify a cross-sell token.
 * Returns { valid: true, payload } for a valid, non-expired token.
 * Returns { valid: false } on any error (expired, tampered, malformed, no secret).
 * Uses timingSafeEqual for HMAC comparison.
 */
export function verifyCrossSellToken(token: string): {
    valid: boolean
    payload?: CrossSellTokenPayload
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

        // Reconstruct HMAC from stored payload and expiry
        const payloadStr = base64UrlDecode(payloadEncoded).toString("utf8")
        const message = `${payloadStr}\n${expiryStr}`
        const expected = createHmac("sha256", secret).update(message).digest()
        const received = base64UrlDecode(sigB64)
        if (expected.length !== received.length) return { valid: false }
        if (!timingSafeEqual(expected, received)) return { valid: false }

        // Parse payload fields: sourceOrderId\ntargetProductId\ndiscountPercent
        const payloadLines = payloadStr.split("\n")
        if (payloadLines.length !== 3) return { valid: false }
        const [sourceOrderId, targetProductId, discountPercentStr] = payloadLines
        const discountPercent = Number(discountPercentStr)
        if (!sourceOrderId || !targetProductId || Number.isNaN(discountPercent)) return { valid: false }

        return {
            valid: true,
            payload: { sourceOrderId, targetProductId, discountPercent, exp: expiry },
        }
    } catch {
        return { valid: false }
    }
}
