"use client"

import { useEffect, useSyncExternalStore } from "react"

// External-store subscribe lives at module scope so every consumer
// shares the same single listener pair on window.visualViewport. The
// component just `useSyncExternalStore`s and gets fresh height changes
// without each instance attaching its own resize/scroll handler.
const listeners = new Set<() => void>()
let attached = false

function attach() {
    if (attached || typeof window === "undefined" || !window.visualViewport) return
    const vp = window.visualViewport
    const onChange = () => {
        for (const l of listeners) l()
    }
    vp.addEventListener("resize", onChange)
    vp.addEventListener("scroll", onChange)
    attached = true
}

function subscribe(cb: () => void) {
    listeners.add(cb)
    attach()
    return () => {
        listeners.delete(cb)
    }
}

function getSnapshot(): number {
    if (typeof window === "undefined" || !window.visualViewport) return 0
    // Soft keyboard: difference between layout viewport height and
    // visualViewport height is the keyboard's overlay region. Add
    // `offsetTop` because some Android browsers report the viewport
    // as shifted up rather than shrunk.
    const inset =
        window.innerHeight -
        (window.visualViewport.height + window.visualViewport.offsetTop)
    // Tiny rounding noise (≤2px from URL bar animations) → treat as 0
    // so we don't bounce the composer when no keyboard is open.
    return inset > 2 ? Math.round(inset) : 0
}

// SSR snapshot: 0 means "no keyboard inset known yet" — matches the
// default no-keyboard rendering, so the first client paint doesn't
// flash a jump.
function getServerSnapshot(): number {
    return 0
}

/**
 * Returns the on-screen keyboard's overlay height in px (0 when no
 * keyboard is open or the browser doesn't expose visualViewport).
 *
 * Use this to pad the bottom of a fixed bottom-anchored panel (chat
 * composer, dialog footer) so the input isn't covered by the keyboard
 * on iOS Safari, where `100dvh` does NOT shrink for the keyboard.
 */
export function useKeyboardInset(): number {
    // useEffect early-attach so the very first focus event has a
    // listener ready (subscribe runs on mount too, but the touch may
    // race the React commit on a cold open).
    useEffect(() => {
        attach()
    }, [])
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
