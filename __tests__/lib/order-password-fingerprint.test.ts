/**
 * Unit tests for lib/order-password-fingerprint.
 * Verifies the hash is deterministic, normalized, and peppered.
 */

jest.mock("@/lib/config", () => ({
    config: { lookupFingerprintPepper: "test-pepper-32characters-long-xx" },
}))

jest.mock("@/lib/prisma", () => ({
    prisma: { order: { updateMany: jest.fn() } },
}))

import { computePasswordFingerprint, backfillFingerprintIfMissing } from "@/lib/order-password-fingerprint"
import { prisma } from "@/lib/prisma"

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

describe("backfillFingerprintIfMissing", () => {
    const updateMany = prisma.order.updateMany as jest.Mock

    beforeEach(() => {
        updateMany.mockReset()
    })

    it("updates only orders where passwordFingerprint is null", async () => {
        updateMany.mockResolvedValue({ count: 1 })
        await backfillFingerprintIfMissing("ord-1", "buyer@example.com", "secret123")
        expect(updateMany).toHaveBeenCalledWith({
            where: { id: "ord-1", passwordFingerprint: null },
            data: { passwordFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
        })
    })

    it("is a no-op (count=0) when the order already has a fingerprint — idempotent", async () => {
        updateMany.mockResolvedValue({ count: 0 })
        await expect(
            backfillFingerprintIfMissing("ord-2", "buyer@example.com", "secret123"),
        ).resolves.toBeUndefined()
        // Still attempted (one query); the `where` guard prevents over-write.
        expect(updateMany).toHaveBeenCalledTimes(1)
    })

    it("swallows errors so a failed backfill never breaks the verify response", async () => {
        updateMany.mockRejectedValue(new Error("connection lost"))
        await expect(
            backfillFingerprintIfMissing("ord-3", "buyer@example.com", "secret123"),
        ).resolves.toBeUndefined()
    })
})
