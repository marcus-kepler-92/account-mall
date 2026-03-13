"use client"

import { useState, useEffect } from "react"

let cachedVisitorId: string | null = null

/**
 * 异步获取 FingerprintJS 浏览器指纹 visitorId。
 * 结果缓存在模块级变量中，同一页面生命周期内只初始化一次。
 * 返回 null 表示尚未就绪或不支持。
 */
export function useFingerprint(): string | null {
    const [visitorId, setVisitorId] = useState<string | null>(cachedVisitorId)

    useEffect(() => {
        if (cachedVisitorId) {
            setVisitorId(cachedVisitorId)
            return
        }

        let cancelled = false

        async function load() {
            try {
                const FingerprintJS = await import("@fingerprintjs/fingerprintjs")
                const fp = await FingerprintJS.load()
                const result = await fp.get()
                if (!cancelled) {
                    cachedVisitorId = result.visitorId
                    setVisitorId(result.visitorId)
                }
            } catch {
                // 静默降级：不支持时返回 null，不影响核心购买流程
            }
        }

        load()

        return () => {
            cancelled = true
        }
    }, [])

    return visitorId
}
