"use client"

import dynamic from "next/dynamic"

const FloatingChat = dynamic(
    () => import("./floating-chat").then((m) => m.FloatingChat),
    { ssr: false },
)

export function FloatingChatLoader() {
    return <FloatingChat />
}
