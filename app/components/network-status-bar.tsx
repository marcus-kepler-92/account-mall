"use client"

import { useState, useEffect } from "react"
import { WifiOff } from "lucide-react"

export function NetworkStatusBar() {
    const [online, setOnline] = useState(true)

    useEffect(() => {
        const goOnline = () => setOnline(true)
        const goOffline = () => setOnline(false)
        window.addEventListener("online", goOnline)
        window.addEventListener("offline", goOffline)
        setOnline(navigator.onLine)
        return () => {
            window.removeEventListener("online", goOnline)
            window.removeEventListener("offline", goOffline)
        }
    }, [])

    if (online) return null

    return (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-destructive py-1.5 text-sm text-destructive-foreground">
            <WifiOff className="size-4" />
            网络连接已断开，部分功能暂时不可用
        </div>
    )
}
