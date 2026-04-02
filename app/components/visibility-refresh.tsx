"use client"

import { useDocumentVisibility } from "ahooks"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

export function VisibilityRefresh() {
    const router = useRouter()
    const visibility = useDocumentVisibility()
    const mounted = useRef(false)

    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true
            return
        }
        if (visibility === "visible") {
            router.refresh()
        }
    }, [visibility, router])

    return null
}
