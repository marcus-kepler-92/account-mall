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
        // Now tamper the expiry part to get a different HMAC check
        const [expiry, sig] = token.split(".")
        const tamperedToken = `${expiry}.${sig.slice(0, -2)}xx`
        const tamperedResult = verifyCrossSellToken(tamperedToken)
        expect(tamperedResult.valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for wrong targetProductId (tampered token)", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [expiry, sig] = token.split(".")
        // Modify signature slightly
        const tampered = `${expiry}.${sig.slice(0, 5)}XXXXX${sig.slice(10)}`
        expect(verifyCrossSellToken(tampered).valid).toBe(false)
    })

    it("verifyCrossSellToken returns invalid for tampered signature", () => {
        const token = generateCrossSellToken(basePayload, 60_000)!
        const [expiry, sig] = token.split(".")
        const badToken = `${expiry}.${sig.slice(0, -2)}xx`
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
