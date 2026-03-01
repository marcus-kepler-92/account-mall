"use client"

import "@uiw/react-markdown-preview/markdown.css"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import DOMPurify from "isomorphic-dompurify"
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
 * Renders product description: Markdown 用 @uiw/react-markdown-preview 的 GitHub 风格样式并随主题切换，旧 HTML 用消毒后 prose。
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

    // 跟随 next-themes：未挂载或未解析时用 light，避免闪烁；切换主题后 resolvedTheme 更新会触发重渲染
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
