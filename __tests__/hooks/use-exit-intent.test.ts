/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { renderHook, act } from "@testing-library/react"
import { useExitIntent } from "@/hooks/use-exit-intent"

/** Helper to mock window.matchMedia for desktop vs mobile */
function mockMatchMedia(matches: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: jest.fn().mockImplementation((query: string) => ({
            matches: query === "(pointer: coarse)" ? matches : false,
            media: query,
            onchange: null,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    })
}

/** Helper to fire a mouseleave event with a given clientY */
function fireMouseLeave(clientY: number) {
    const event = new MouseEvent("mouseleave", { clientY, bubbles: false, cancelable: true })
    Object.defineProperty(event, "clientY", { value: clientY })
    document.dispatchEvent(event)
}

/** Helper to simulate scroll to a given depth (0–1) */
function fireScrollAtDepth(depth: number) {
    const docHeight = 2000
    const viewportHeight = 500
    // Set up scrollHeight and innerHeight
    Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        value: docHeight + viewportHeight,
    })
    Object.defineProperty(window, "innerHeight", {
        writable: true,
        value: viewportHeight,
    })
    Object.defineProperty(window, "scrollY", {
        writable: true,
        value: Math.floor(depth * docHeight),
    })
    window.dispatchEvent(new Event("scroll"))
}

describe("useExitIntent", () => {
    const storageKey = "test-exit-intent"

    beforeEach(() => {
        sessionStorage.clear()
        // Default: desktop (pointer: fine)
        mockMatchMedia(false)
        jest.spyOn(Date, "now").mockRestore()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe("desktop (pointer: fine)", () => {
        it("triggers onTrigger when mouseleave with clientY <= 0 after minTimeMs", () => {
            const onTrigger = jest.fn()
            // Simulate elapsed time > minTimeMs (use minTimeMs=0 for simplicity)
            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 0 })
            )

            act(() => {
                fireMouseLeave(0)
            })

            expect(onTrigger).toHaveBeenCalledTimes(1)
        })

        it("does not trigger when clientY > 0", () => {
            const onTrigger = jest.fn()
            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 0 })
            )

            act(() => {
                fireMouseLeave(50)
            })

            expect(onTrigger).not.toHaveBeenCalled()
        })

        it("does not trigger when minTimeMs has not elapsed", () => {
            const onTrigger = jest.fn()
            const fixedTime = 1_000_000
            jest.spyOn(Date, "now").mockReturnValue(fixedTime)

            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 15_000 })
            )

            // Advance time but not enough
            jest.spyOn(Date, "now").mockReturnValue(fixedTime + 5_000)

            act(() => {
                fireMouseLeave(0)
            })

            expect(onTrigger).not.toHaveBeenCalled()
        })

        it("does not trigger when sessionStorage key is already set", () => {
            sessionStorage.setItem(storageKey, "1")
            const onTrigger = jest.fn()

            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 0 })
            )

            act(() => {
                fireMouseLeave(0)
            })

            expect(onTrigger).not.toHaveBeenCalled()
        })

        it("sets sessionStorage key after triggering", () => {
            const onTrigger = jest.fn()
            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 0 })
            )

            act(() => {
                fireMouseLeave(0)
            })

            expect(sessionStorage.getItem(storageKey)).toBe("1")
        })

        it("does not trigger when disabled=true", () => {
            const onTrigger = jest.fn()
            renderHook(() =>
                useExitIntent({ storageKey, onTrigger, minTimeMs: 0, disabled: true })
            )

            act(() => {
                fireMouseLeave(0)
            })

            expect(onTrigger).not.toHaveBeenCalled()
        })
    })

    describe("mobile (pointer: coarse)", () => {
        beforeEach(() => {
            mockMatchMedia(true) // mobile
        })

        it("triggers onTrigger when scroll depth exceeds mobileScrollDepth threshold", () => {
            const onTrigger = jest.fn()
            renderHook(() =>
                useExitIntent({
                    storageKey,
                    onTrigger,
                    minTimeMs: 0,
                    mobileScrollDepth: 0.4,
                })
            )

            act(() => {
                fireScrollAtDepth(0.5) // 50% > 40%
            })

            expect(onTrigger).toHaveBeenCalledTimes(1)
        })

        it("does not trigger when scroll depth is below mobileScrollDepth threshold", () => {
            const onTrigger = jest.fn()
            renderHook(() =>
                useExitIntent({
                    storageKey,
                    onTrigger,
                    minTimeMs: 0,
                    mobileScrollDepth: 0.4,
                })
            )

            act(() => {
                fireScrollAtDepth(0.2) // 20% < 40%
            })

            expect(onTrigger).not.toHaveBeenCalled()
        })
    })
})
