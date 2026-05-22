/**
 * Unit tests for cs token: generate / verify, expiry, tampering.
 * Token carries only sourceOrderId + exp; eligible targets and discount %
 * are resolved separately by resolveCrossSellDiscount.
 */

import { generateCsToken, verifyCsToken } from "@/lib/cross-sell-token"

jest.mock("@/lib/config", () => ({
    config: {
        crossSellTokenSecret: "test-cross-sell-secret-16chars!!",
        betterAuthSecret: "fallback-secret-16chars!!",
    },
}))

const SOURCE_ORDER_ID = "order-001"

describe("cs token", () => {
    it("generateCsToken returns a 3-part dotted string", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, 60_000)
        expect(token).not.toBeNull()
        expect(typeof token).toBe("string")
        expect(token!.split(".")).toHaveLength(3)
    })

    it("verifyCsToken returns valid + payload for a freshly issued token", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, 60_000)!
        const result = verifyCsToken(token)
        expect(result.valid).toBe(true)
        expect(result.payload?.sourceOrderId).toBe(SOURCE_ORDER_ID)
        expect(typeof result.payload?.exp).toBe("number")
    })

    it("verifyCsToken rejects expired tokens", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, -1)!
        expect(verifyCsToken(token).valid).toBe(false)
    })

    it("verifyCsToken rejects tampered signature", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, 60_000)!
        const [expiry, payloadEnc, sig] = token.split(".")
        const tampered = `${expiry}.${payloadEnc}.${sig.slice(0, -2)}xx`
        expect(verifyCsToken(tampered).valid).toBe(false)
    })

    it("verifyCsToken rejects tampered sourceOrderId in payload", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, 60_000)!
        const [expiryStr, , sig] = token.split(".")
        // Substitute a different sourceOrderId, keep the original HMAC
        const fakeEnc = Buffer.from("order-999", "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        const tampered = `${expiryStr}.${fakeEnc}.${sig}`
        expect(verifyCsToken(tampered).valid).toBe(false)
    })

    it("verifyCsToken rejects tampered expiry", () => {
        const token = generateCsToken(SOURCE_ORDER_ID, 60_000)!
        const [, payloadEnc, sig] = token.split(".")
        const newExpiry = String(Date.now() + 3_600_000)
        const tampered = `${newExpiry}.${payloadEnc}.${sig}`
        expect(verifyCsToken(tampered).valid).toBe(false)
    })

    it("verifyCsToken rejects malformed tokens", () => {
        expect(verifyCsToken("nodot").valid).toBe(false)
        expect(verifyCsToken("1234567890.").valid).toBe(false)
        expect(verifyCsToken("a.b").valid).toBe(false)
    })

    it("different sourceOrderId produces different token", () => {
        const t1 = generateCsToken("order-001", 60_000)!
        const t2 = generateCsToken("order-999", 60_000)!
        expect(t1).not.toBe(t2)
        expect(verifyCsToken(t1).payload?.sourceOrderId).toBe("order-001")
        expect(verifyCsToken(t2).payload?.sourceOrderId).toBe("order-999")
    })

    it("generateCsToken returns null when no secret is configured", () => {
        const cfg = require("@/lib/config").config
        const origCross = cfg.crossSellTokenSecret
        const origAuth = cfg.betterAuthSecret
        cfg.crossSellTokenSecret = undefined
        cfg.betterAuthSecret = "short"
        expect(generateCsToken(SOURCE_ORDER_ID, 60_000)).toBeNull()
        cfg.crossSellTokenSecret = origCross
        cfg.betterAuthSecret = origAuth
    })

    it("verifyCsToken returns invalid when no secret is configured", () => {
        const cfg = require("@/lib/config").config
        const origCross = cfg.crossSellTokenSecret
        const origAuth = cfg.betterAuthSecret
        cfg.crossSellTokenSecret = undefined
        cfg.betterAuthSecret = "short"
        expect(verifyCsToken("123.abc.def").valid).toBe(false)
        cfg.crossSellTokenSecret = origCross
        cfg.betterAuthSecret = origAuth
    })
})
