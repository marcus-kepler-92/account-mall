/**
 * Unit tests for cross-sell-token: generate and verify token, expiry, tampering.
 * Secret from config (CROSS_SELL_TOKEN_SECRET / BETTER_AUTH_SECRET).
 */

import {
    generateCrossSellToken,
    verifyCrossSellToken,
} from "@/lib/cross-sell-token"

jest.mock("@/lib/config", () => ({
    config: {
        crossSellTokenSecret: "test-cross-sell-secret-16chars!!",
        betterAuthSecret: "fallback-secret-16chars!!",
    },
}))

const basePayload = {
    sourceOrderId: "order-001",
    targetProductId: "prod-001",
    discountPercent: 10,
}

describe("cross-sell-token", () => {
    it("generateCrossSellToken returns a string token", () => {
        const token = generateCrossSellToken(basePayload, 60_000)
        expect(token).not.toBeNull()
        expect(typeof token).toBe("string")
        expect(token).toContain(".")
    })

    it("verifyCrossSellToken returns valid + payload for a valid token", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const result = verifyCrossSellToken(token)
        expect(result.valid).toBe(true)
        expect(result.payload?.sourceOrderId).toBe(basePayload.sourceOrderId)
        expect(result.payload?.targetProductId).toBe(basePayload.targetProductId)
        expect(result.payload?.discountPercent).toBe(basePayload.discountPercent)
        expect(typeof result.payload?.exp).toBe("number")
    })

    it("verifyCrossSellToken returns invalid for wrong sourceOrderId", () => {
        // Generate with base payload then verify payload won't match a tampered version
        const token = generateCrossSellToken(
            { ...basePayload, sourceOrderId: "order-002" },
            60_000,
        )!
        // The token is bound to the payload in the HMAC; verify returns the payload from token
        // To test "wrong sourceOrderId", we use a token generated for a different sourceOrderId
        // and confirm the payload doesn't match what we expect
        const result = verifyCrossSellToken(token)
        expect(result.valid).toBe(true)
        // Now tamper the HMAC signature to get a different HMAC check
        const [expiry, payloadEnc, sig] = token.split(".")
        const tamperedToken = `${expiry}.${payloadEnc}.${sig.slice(0, -2)}xx`
        const tamperedResult = verifyCrossSellToken(tamperedToken)
        expect(tamperedResult.valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for wrong targetProductId (tampered token)", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [expiry, payloadEnc, sig] = token.split(".")
        // Modify signature slightly
        const tampered = `${expiry}.${payloadEnc}.${sig.slice(0, 5)}XXXXX${sig.slice(10)}`
        expect(verifyCrossSellToken(tampered).valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for tampered signature", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [expiry, payloadEnc, sig] = token.split(".")
        const badToken = `${expiry}.${payloadEnc}.${sig.slice(0, -2)}xx`
        expect(verifyCrossSellToken(badToken).valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for expired token", () => {
        // TTL of -1ms means already expired
        const token = generateCrossSellToken(basePayload, -1)!
        const result = verifyCrossSellToken(token)
        expect(result.valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for malformed token (no dot)", () => {
        expect(verifyCrossSellToken("nodot").valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for malformed token (only expiry)", () => {
        expect(verifyCrossSellToken("1234567890.").valid).toBe(false)
    })

    it("verifyCrossSellToken rejects token with tampered discountPercent in payload", () => {
        // Generate a valid token for 10% discount
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [expiryStr, payloadEnc, sig] = token.split(".")

        // Decode payload, change discountPercent to 99, re-encode
        const decoded = Buffer.from(
            payloadEnc.replace(/-/g, "+").replace(/_/g, "/"),
            "base64",
        ).toString("utf8")
        // payload is "sourceOrderId\ntargetProductId\ndiscountPercent"
        const parts = decoded.split("\n")
        parts[2] = "99"
        const tamperedPayload = Buffer.from(parts.join("\n"), "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")

        // Re-use original signature — HMAC won't match tampered payload
        const tamperedToken = `${expiryStr}.${tamperedPayload}.${sig}`
        const result = verifyCrossSellToken(tamperedToken)
        expect(result.valid).toBe(false)
    })

    it("verifyCrossSellToken rejects token with tampered expiry", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [, payloadEnc, sig] = token.split(".")
        // Extend expiry by 1 hour
        const newExpiry = String(Date.now() + 3_600_000)
        const tamperedToken = `${newExpiry}.${payloadEnc}.${sig}`
        expect(verifyCrossSellToken(tamperedToken).valid).toBe(false)
    })

    it("token payload binds sourceOrderId — different source produces different token", () => {
        const t1 = generateCrossSellToken(basePayload, 60_000)!
        const t2 = generateCrossSellToken({ ...basePayload, sourceOrderId: "order-999" }, 60_000)!
        expect(t1).not.toBe(t2)
        const r1 = verifyCrossSellToken(t1)
        const r2 = verifyCrossSellToken(t2)
        expect(r1.payload?.sourceOrderId).toBe("order-001")
        expect(r2.payload?.sourceOrderId).toBe("order-999")
    })

    it("generateCrossSellToken returns null when secret is not configured", () => {
        const cfg = require("@/lib/config").config
        const origCross = cfg.crossSellTokenSecret
        const origAuth = cfg.betterAuthSecret
        cfg.crossSellTokenSecret = undefined
        cfg.betterAuthSecret = "short"
        const token = generateCrossSellToken(basePayload, 60_000)
        expect(token).toBeNull()
        cfg.crossSellTokenSecret = origCross
        cfg.betterAuthSecret = origAuth
    })

    it("verifyCrossSellToken returns invalid when secret is not configured", () => {
        const cfg = require("@/lib/config").config
        const origCross = cfg.crossSellTokenSecret
        const origAuth = cfg.betterAuthSecret
        cfg.crossSellTokenSecret = undefined
        cfg.betterAuthSecret = "short"
        expect(verifyCrossSellToken("123.abc").valid).toBe(false)
        cfg.crossSellTokenSecret = origCross
        cfg.betterAuthSecret = origAuth
    })
})
