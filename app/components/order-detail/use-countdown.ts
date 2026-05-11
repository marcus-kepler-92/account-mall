"use client"

import { useState, useEffect } from "react"

export function useCountdown(expiresAt: string | null): number | null {
    const [remainingMs, setRemainingMs] = useState<number | null>(null)
    useEffect(() => {
        if (!expiresAt) return
        const target = new Date(expiresAt).getTime()
        const update = () => setRemainingMs(Math.max(0, target - Date.now()))
        update()
        const id = setInterval(update, 1000)
        return () => clearInterval(id)
    }, [expiresAt])
    return remainingMs
}

export function formatCountdown(ms: number): string {
    if (ms <= 0) return "已过期"
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}
