/**
 * Unit tests for Turnstile siteverify: verifyTurnstileToken.
 */

import { verifyTurnstileToken } from "@/lib/turnstile"

const originalFetch = global.fetch

describe("verifyTurnstileToken", () => {
    afterEach(() => {
        global.fetch = originalFetch
    })

    it("sends POST to siteverify and returns success true", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ success: true }),
        }) as typeof fetch
        const result = await verifyTurnstileToken("token-123", "secret-key")
        expect(result.success).toBe(true)
        expect(global.fetch).toHaveBeenCalledWith(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            })
        )
        const body = (global.fetch as jest.Mock).mock.calls[0][1].body
        expect(body).toContain("secret=secret-key")
        expect(body).toContain("response=token-123")
    })

    it("includes remoteip when provided", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ success: false, "error-codes": ["invalid"] }),
        }) as typeof fetch
        await verifyTurnstileToken("t", "s", "1.2.3.4")
        const body = (global.fetch as jest.Mock).mock.calls[0][1].body
        expect(body).toContain("remoteip=1.2.3.4")
    })

    it("returns error-codes when verification fails", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            json: async () => ({ success: false, "error-codes": ["timeout-or-duplicate"] }),
        }) as typeof fetch
        const result = await verifyTurnstileToken("bad", "secret")
        expect(result.success).toBe(false)
        expect(result["error-codes"]).toEqual(["timeout-or-duplicate"])
    })
})
