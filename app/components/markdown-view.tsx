"use client"

import "@uiw/react-markdown-preview/markdown.css"
import DOMPurify from "dompurify"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { isLikelyHtml } from "@/lib/description"

const MarkdownPreview = dynamic(
    () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
    { ssr: false }
)

type MarkdownViewProps = {
    content: string
}

const proseClass =
    "prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc"

const subscribe = () => () => {};

// DOMPurify sanitizes HTML before rendering to prevent XSS.
export function MarkdownView({ content }: MarkdownViewProps) {
    const { resolvedTheme } = useTheme()
    // useSyncExternalStore: getServerSnapshot returns "light" to avoid SSR mismatch;
    // getSnapshot returns the actual resolved theme on the client.
    const mounted = useSyncExternalStore(subscribe, () => true, () => false)

    if (!content?.trim()) return null

    if (isLikelyHtml(content)) {
        const sanitized = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [
                "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
                "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
            ],
            ALLOWED_ATTR: ["href", "target", "rel"],
        })

        // Content is sanitized via DOMPurify above before being set as innerHTML.
        return (
            <div
                className={proseClass}
                dangerouslySetInnerHTML={{ __html: sanitized }}
            />
        )
    }

    // Default to "light" before client mount to avoid hydration mismatch.
    const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light"
    return (
        <div
            data-color-mode={colorMode}
            className="wmde-markdown-var wmde-theme-bridge"
        >
            <MarkdownPreview source={content} />
        </div>
    )
}
