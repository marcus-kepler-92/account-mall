/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { renderHook, waitFor } from "@testing-library/react"

// Mock the FingerprintJS package (installed in node_modules)
jest.mock("@fingerprintjs/fingerprintjs", () => ({
    load: jest.fn(),
}))

/**
 * NOTE: The `useFingerprint` hook has a module-level `cachedVisitorId` variable.
 * Tests below are deliberately ordered so that:
 *   1. Error test runs first (cache is null → returns null)
 *   2. Success test runs second (cache is null → loads FP → returns visitorId, sets cache)
 *   3. Cache test runs third (cache is set from test 2 → returns immediately without calling load)
 */
describe("useFingerprint", () => {
    const fpMod = require("@fingerprintjs/fingerprintjs")

    beforeEach(() => {
        ;(fpMod.load as jest.Mock).mockReset()
    })

    it("1. returns null when FingerprintJS.load throws (silent degradation)", async () => {
        ;(fpMod.load as jest.Mock).mockRejectedValue(new Error("FP not supported in this env"))

        const { useFingerprint } = require("@/hooks/use-fingerprint")
        const { result } = renderHook(() => useFingerprint())

        // Initially null
        expect(result.current).toBeNull()

        // After error, still null (cache not set)
        await new Promise((r) => setTimeout(r, 50))
        expect(result.current).toBeNull()
    })

    it("2. returns visitorId after FingerprintJS loads successfully", async () => {
        ;(fpMod.load as jest.Mock).mockResolvedValue({
            get: jest.fn().mockResolvedValue({ visitorId: "fp-visitor-abc123" }),
        })

        const { useFingerprint } = require("@/hooks/use-fingerprint")
        const { result } = renderHook(() => useFingerprint())

        await waitFor(() => {
            expect(result.current).toBe("fp-visitor-abc123")
        })
    })

    it("3. returns cached visitorId on subsequent renders without calling load again", async () => {
        // At this point, cachedVisitorId = "fp-visitor-abc123" (set by test 2)
        ;(fpMod.load as jest.Mock).mockReset()

        const { useFingerprint } = require("@/hooks/use-fingerprint")
        const { result } = renderHook(() => useFingerprint())

        // Cache should be used immediately (synchronous initial state)
        expect(result.current).toBe("fp-visitor-abc123")

        // load should NOT have been called since cache was used
        await new Promise((r) => setTimeout(r, 50))
        expect(fpMod.load).not.toHaveBeenCalled()
    })
})
