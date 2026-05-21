/**
 * @jest-environment jsdom
 */
import { renderHook, act } from "@testing-library/react"

type Listener = (e: Event) => void

class FakeVisualViewport extends EventTarget {
    height = 800
    offsetTop = 0
    listeners = new Map<string, Set<Listener>>()
    addEventListener(type: string, cb: Listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set())
        this.listeners.get(type)!.add(cb)
    }
    removeEventListener(type: string, cb: Listener) {
        this.listeners.get(type)?.delete(cb)
    }
    fire(type: string) {
        for (const cb of this.listeners.get(type) ?? []) cb(new Event(type))
    }
}

// Hook keeps module-level state (single attach() per page), so we use
// ONE shared vp across all tests and reset its values between cases.
// Replacing `window.visualViewport` mid-suite would orphan the
// previously-attached listeners and the new viewport would never fire
// for the subscribed React tree.
const vp = new FakeVisualViewport()
Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
Object.defineProperty(window, "visualViewport", { configurable: true, value: vp })

// Import after window is stubbed so attach()'s first call sees the fake.
import { useKeyboardInset } from "@/hooks/use-keyboard-inset"

describe("useKeyboardInset", () => {
    beforeEach(() => {
        // Reset vp to the no-keyboard baseline before each test.
        vp.height = 800
        vp.offsetTop = 0
    })

    it("returns 0 when no keyboard is open (visualViewport.height matches innerHeight)", () => {
        const { result } = renderHook(() => useKeyboardInset())
        expect(result.current).toBe(0)
    })

    it("reports the keyboard overlay height when visualViewport shrinks", () => {
        const { result } = renderHook(() => useKeyboardInset())
        expect(result.current).toBe(0)
        act(() => {
            vp.height = 480 // iPhone with QWERTY keyboard open
            vp.fire("resize")
        })
        expect(result.current).toBe(320) // 800 - 480
    })

    it("treats sub-pixel noise (≤2px from URL bar animations) as zero — no composer bounce", () => {
        const { result } = renderHook(() => useKeyboardInset())
        act(() => {
            vp.height = 799 // 1px lost to a partial URL bar slide
            vp.fire("resize")
        })
        expect(result.current).toBe(0)
        act(() => {
            vp.height = 797 // 3px → real shrink, report it
            vp.fire("resize")
        })
        expect(result.current).toBe(3)
    })

    it("accounts for Android browsers that shift the viewport up instead of shrinking", () => {
        const { result } = renderHook(() => useKeyboardInset())
        act(() => {
            vp.height = 500
            vp.offsetTop = 100 // Android: viewport shifted up by 100, also shorter
            vp.fire("resize")
        })
        // overlay = innerHeight - (visualHeight + offsetTop) = 800 - (500 + 100) = 200
        expect(result.current).toBe(200)
    })
})
