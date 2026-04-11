"use client"

import { useEffect, useRef, useCallback } from "react"

type UseExitIntentOptions = {
    /** 触发前最短停留时间（毫秒），默认 15 秒 */
    minTimeMs?: number
    /** sessionStorage key，防止同一 session 多次触发 */
    storageKey: string
    onTrigger: () => void
    /** 是否禁用（例如：用户已下单、售罄） */
    disabled?: boolean
}

/**
 * 离开挽留触发检测 hook。
 * - 桌面端：鼠标移出视口上方（mouseleave on document）
 * - 移动端：返回手势/按钮（pushState sentinel + popstate）
 * - 频率控制：每个 session 每个 storageKey 只触发一次
 * - 前置条件：停留超过 minTimeMs
 */
export function useExitIntent({
    minTimeMs = 15_000,
    storageKey,
    onTrigger,
    disabled = false,
}: UseExitIntentOptions) {
    const mountedAtRef = useRef<number>(Date.now())
    const triggeredRef = useRef<boolean>(false)
    const sentinelPushedRef = useRef<boolean>(false)

    const checkAndTrigger = useCallback(() => {
        if (triggeredRef.current || disabled) return
        if (Date.now() - mountedAtRef.current < minTimeMs) return

        try {
            if (sessionStorage.getItem(storageKey)) return
        } catch {
            // sessionStorage 不可用时跳过频率控制
        }

        triggeredRef.current = true
        try {
            sessionStorage.setItem(storageKey, "1")
        } catch {
            // ignore
        }
        onTrigger()
    }, [disabled, minTimeMs, storageKey, onTrigger])

    // 桌面端：mouseleave 检测光标移出视口顶部
    useEffect(() => {
        if (disabled) return
        if (typeof window === "undefined") return

        const isMobile = window.matchMedia("(pointer: coarse)").matches
        if (isMobile) return

        function handleMouseLeave(e: MouseEvent) {
            if (e.clientY <= 0) {
                checkAndTrigger()
            }
        }

        document.addEventListener("mouseleave", handleMouseLeave)
        return () => document.removeEventListener("mouseleave", handleMouseLeave)
    }, [disabled, checkAndTrigger])

    // 移动端：返回手势/按钮检测
    // 推入 sentinel 历史记录，popstate 触发时说明用户按了返回，URL 不变所以页面不跳转
    useEffect(() => {
        if (disabled) return
        if (typeof window === "undefined") return

        const isMobile = window.matchMedia("(pointer: coarse)").matches
        if (!isMobile) return

        if (!sentinelPushedRef.current) {
            history.pushState({ __exitIntentGuard: true }, "", window.location.href)
            sentinelPushedRef.current = true
        }

        function handlePopState() {
            checkAndTrigger()
        }

        window.addEventListener("popstate", handlePopState)
        return () => window.removeEventListener("popstate", handlePopState)
    }, [disabled, checkAndTrigger])
}
