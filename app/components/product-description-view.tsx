"use client"

import "@uiw/react-markdown-preview/markdown.css"
import DOMPurify from "dompurify"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { isLikelyHtml } from "@/lib/description"

const MarkdownPreview = dynamic(
    () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
    { ssr: false }
)

type ProductDescriptionViewProps = {
    description: string
}

const proseClass =
    "prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc"

/**
 * Renders product description: Markdown uses @uiw/react-markdown-preview GitHub-style rendering, while legacy HTML is sanitized before rendering in prose.
 */
export function ProductDescriptionView({ description }: ProductDescriptionViewProps) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    if (!description?.trim()) return null

    if (isLikelyHtml(description)) {
        const sanitized = DOMPurify.sanitize(description, {
            ALLOWED_TAGS: [
                "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
                "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre",
            ],
            ALLOWED_ATTR: ["href", "target", "rel"],
        })

        return (
            <div
                className={proseClass}
                dangerouslySetInnerHTML={{ __html: sanitized }}
            />
        )
    }

    // Follow next-themes: default to light before mount/theme resolution to avoid flashing.
    const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light"
    return (
        <div
            data-color-mode={colorMode}
            className="wmde-markdown-var product-description-markdown"
        >
            <MarkdownPreview source={description} />
        </div>
    )
}
