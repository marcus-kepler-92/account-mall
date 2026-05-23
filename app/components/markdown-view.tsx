"use client"

import "@uiw/react-markdown-preview/markdown.css"
import DOMPurify from "dompurify"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { isLikelyHtml } from "@/lib/description"
import { Skeleton } from "@/components/ui/skeleton"

// `ssr: false` makes the preview render only after the chunk lands client-side.
// Without `loading`, the wrapper div is empty during that window — the parent
// page shows headers/badges/timestamps but a blank body, so users on slow
// networks think the page is broken. The skeleton fills that hole.
const MarkdownPreview = dynamic(
    () => import("@uiw/react-markdown-preview").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => (
            <div className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        ),
    },
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
            <MarkdownPreview
                source={content}
                components={{
                    // Do NOT spread `...props` here — react-markdown passes its
                    // internal `node` (an mdast object) plus other non-DOM keys
                    // that React then renders as `node="[object Object]"` HTML
                    // attributes. We forward only safe DOM attrs explicitly.
                    img: ({ src, alt, title, width, height, loading }) =>
                        src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={src}
                                alt={alt || ""}
                                title={title}
                                width={width}
                                height={height}
                                loading={loading ?? "lazy"}
                            />
                        ) : null,
                }}
            />
        </div>
    )
}
