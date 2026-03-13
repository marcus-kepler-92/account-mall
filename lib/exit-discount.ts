import { createHmac } from "crypto"

export type ExitDiscountPayload = {
    productId: string
    visitorId: string
    fingerprintHash: string
    ip: string
    discountPercent: number
    exp: number
}

export type ExitDiscountMeta = {
    productId: string
    visitorId: string
    fingerprintHash: string
    ip: string
    discountPercent: number
}

function signPayload(payload: ExitDiscountPayload, secret: string): string {
    const data = JSON.stringify(payload)
    const encoded = Buffer.from(data).toString("base64url")
    const sig = createHmac("sha256", secret).update(encoded).digest("base64url")
    return `${encoded}.${sig}`
}

export function generateExitDiscountToken(
    payload: Omit<ExitDiscountPayload, "exp">,
    secret: string,
    ttlMs: number
): string {
    const fullPayload: ExitDiscountPayload = {
        ...payload,
        exp: Date.now() + ttlMs,
    }
    return signPayload(fullPayload, secret)
}

export type VerifyResult =
    | { valid: true; payload: ExitDiscountPayload }
    | { valid: false; reason: "expired" | "invalid" }

export function verifyExitDiscountToken(token: string, secret: string): VerifyResult {
    try {
        const dotIndex = token.lastIndexOf(".")
        if (dotIndex < 0) return { valid: false, reason: "invalid" }

        const encoded = token.slice(0, dotIndex)
        const sig = token.slice(dotIndex + 1)

        const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url")
        if (sig !== expectedSig) return { valid: false, reason: "invalid" }

        const data = Buffer.from(encoded, "base64url").toString("utf8")
        const payload = JSON.parse(data) as ExitDiscountPayload

        if (Date.now() > payload.exp) return { valid: false, reason: "expired" }

        return { valid: true, payload }
    } catch {
        return { valid: false, reason: "invalid" }
    }
}
