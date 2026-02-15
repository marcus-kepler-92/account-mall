const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

export type SiteverifyResponse = {
    success: boolean
    "error-codes"?: string[]
    challenge_ts?: string
}

/**
 * Verify a Turnstile token with Cloudflare siteverify API.
 * Returns { success: true } on valid token, { success: false, "error-codes": [...] } otherwise.
 */
export async function verifyTurnstileToken(
    token: string,
    secret: string,
    remoteIp?: string
): Promise<SiteverifyResponse> {
    const body = new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
    })
    const res = await fetch(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    })
    const data = (await res.json()) as SiteverifyResponse
    return data
}
