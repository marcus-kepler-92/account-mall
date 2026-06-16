"use client"

import { useSyncExternalStore } from "react"
import { WifiOff } from "lucide-react"

// Subscribe to the browser's online/offline events — the canonical
// useSyncExternalStore use case (see react.dev). Server snapshot assumes online
// so SSR markup renders nothing.
function subscribe(callback: () => void) {
    window.addEventListener("online", callback)
    window.addEventListener("offline", callback)
    return () => {
        window.removeEventListener("online", callback)
        window.removeEventListener("offline", callback)
    }
}

export function NetworkStatusBar() {
    const online = useSyncExternalStore(
        subscribe,
        () => navigator.onLine,
        () => true,
    )

    if (online) return null

    return (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive py-1.5 text-sm text-white">
            <WifiOff className="size-4" />
            网络连接已断开，部分功能暂时不可用
        </div>
    )
}
