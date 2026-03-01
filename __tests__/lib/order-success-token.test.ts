/**
 * Unit tests for order-success-token: create and verify token, expiry, tampering.
 * Secret from config (ORDER_SUCCESS_TOKEN_SECRET / BETTER_AUTH_SECRET).
 */

import {
    createOrderSuccessToken,
    verifyOrderSuccessToken,
} from "@/lib/order-success-token"

jest.mock("@/lib/config", () => ({
    config: {
        orderSuccessTokenSecret: "test-secret-at-least-16-chars",
        betterAuthSecret: "fallback-secret",
    },
}))

describe("order-success-token", () => {
    it("createOrderSuccessToken returns a string token", () => {
        const token = createOrderSuccessToken("ORDER-001")
        expect(token).not.toBeNull()
        expect(typeof token).toBe("string")
        expect(token).toContain(".")
    })

    it("verifyOrderSuccessToken returns true for valid token", () => {
        const token = createOrderSuccessToken("ORDER-002")
        expect(token).not.toBeNull()
        expect(verifyOrderSuccessToken("ORDER-002", token!)).toBe(true)
    })

    it("verifyOrderSuccessToken returns false for wrong orderNo", () => {
        const token = createOrderSuccessToken("ORDER-003")
        expect(verifyOrderSuccessToken("ORDER-OTHER", token!)).toBe(false)
    })

    it("verifyOrderSuccessToken returns false for tampered signature", () => {
        const token = createOrderSuccessToken("ORDER-004")
        const [expiry, sig] = token!.split(".")
        const badToken = `${expiry}.${sig.slice(0, -2)}xx`
        expect(verifyOrderSuccessToken("ORDER-004", badToken)).toBe(false)
    })

    it("verifyOrderSuccessToken returns false for malformed token", () => {
        expect(verifyOrderSuccessToken("ORDER-005", "no-dot")).toBe(false)
        expect(verifyOrderSuccessToken("ORDER-005", "only.expiry")).toBe(false)
    })

    it("createOrderSuccessToken returns null when secret is not configured", () => {
        const config = require("@/lib/config").config
        const origOrder = config.orderSuccessTokenSecret
        const origAuth = config.betterAuthSecret
        config.orderSuccessTokenSecret = undefined
        config.betterAuthSecret = "short"
        const token = createOrderSuccessToken("ORDER-006")
        expect(token).toBeNull()
        config.orderSuccessTokenSecret = origOrder
        config.betterAuthSecret = origAuth
    })

    it("verifyOrderSuccessToken returns false when secret is not configured", () => {
        const config = require("@/lib/config").config
        const origOrder = config.orderSuccessTokenSecret
        const origAuth = config.betterAuthSecret
        config.orderSuccessTokenSecret = undefined
        config.betterAuthSecret = "short"
        expect(verifyOrderSuccessToken("ORDER-007", "123.abc")).toBe(false)
        config.orderSuccessTokenSecret = origOrder
        config.betterAuthSecret = origAuth
    })
})
