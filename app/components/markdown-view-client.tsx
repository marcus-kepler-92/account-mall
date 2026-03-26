"use client"

import dynamic from "next/dynamic"

type MarkdownViewClientProps = {
    content: string
}

const MarkdownView = dynamic(
    () => import("@/app/components/markdown-view").then((mod) => mod.MarkdownView),
    { ssr: false }
)

export function MarkdownViewClient({ content }: MarkdownViewClientProps) {
    return <MarkdownView content={content} />
}
