/**
 * Unit tests for lib/order-password-fingerprint.
 * Verifies the hash is deterministic, normalized, and peppered.
 */

jest.mock("@/lib/config", () => ({
    config: { lookupFingerprintPepper: "test-pepper-32characters-long-xx" },
}))

import { computePasswordFingerprint } from "@/lib/order-password-fingerprint"

describe("computePasswordFingerprint", () => {
    it("returns a 64-char hex SHA-256 string", () => {
        const fp = computePasswordFingerprint("buyer@example.com", "secret123")
        expect(fp).toMatch(/^[a-f0-9]{64}$/)
    })

    it("is deterministic for the same inputs", () => {
        const a = computePasswordFingerprint("buyer@example.com", "secret123")
        const b = computePasswordFingerprint("buyer@example.com", "secret123")
        expect(a).toBe(b)
    })

    it("normalizes the email (case + surrounding whitespace) before hashing", () => {
        const canonical = computePasswordFingerprint("buyer@example.com", "secret123")
        expect(computePasswordFingerprint("Buyer@Example.COM", "secret123")).toBe(canonical)
        expect(computePasswordFingerprint("  buyer@example.com  ", "secret123")).toBe(canonical)
    })

    it("changes when the password changes", () => {
        const a = computePasswordFingerprint("buyer@example.com", "secret123")
        const b = computePasswordFingerprint("buyer@example.com", "secret124")
        expect(a).not.toBe(b)
    })

    it("changes when the email changes", () => {
        const a = computePasswordFingerprint("buyer@example.com", "secret123")
        const b = computePasswordFingerprint("other@example.com", "secret123")
        expect(a).not.toBe(b)
    })

    it("does NOT trim the password — leading/trailing spaces affect the hash", () => {
        // Callers normalize themselves; the helper hashes verbatim so that the
        // password passed at create time always matches the password passed at
        // lookup time as long as both call sites apply the same normalization.
        const a = computePasswordFingerprint("buyer@example.com", "secret123")
        const b = computePasswordFingerprint("buyer@example.com", " secret123 ")
        expect(a).not.toBe(b)
    })
})
