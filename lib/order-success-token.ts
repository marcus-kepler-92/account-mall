import { createHmac, timingSafeEqual } from "crypto"

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getSecret(): string | null {
    const secret = process.env.BETTER_AUTH_SECRET ?? process.env.ORDER_SUCCESS_TOKEN_SECRET
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

/**
 * Create a short-lived token for viewing order success page (orderNo + cards).
 * Token is valid for 15 minutes. Returns null if secret is not configured.
 */
export function createOrderSuccessToken(orderNo: string): string | null {
    const secret = getSecret()
    if (!secret) return null
    const expiry = String(Date.now() + TOKEN_TTL_MS)
    const payload = `${orderNo}\n${expiry}`
    const hmac = createHmac("sha256", secret).update(payload).digest()
    return `${expiry}.${base64UrlEncode(hmac)}`
}

/**
 * Verify token for the given orderNo. Returns true if valid and not expired.
 */
export function verifyOrderSuccessToken(orderNo: string, token: string): boolean {
    try {
        const secret = getSecret()
        if (!secret) return false
        const [expiryStr, sigB64] = token.split(".")
        if (!expiryStr || !sigB64) return false
        const expiry = Number(expiryStr)
        if (Number.isNaN(expiry) || Date.now() > expiry) return false
        const payload = `${orderNo}\n${expiryStr}`
        const expected = createHmac("sha256", secret).update(payload).digest()
        const received = base64UrlDecode(sigB64)
        if (expected.length !== received.length) return false
        return timingSafeEqual(expected, received)
    } catch {
        return false
    }
}
