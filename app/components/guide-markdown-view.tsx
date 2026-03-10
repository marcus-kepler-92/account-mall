"use client"

import { useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"

type GuideMarkdownViewProps = {
    content: string
}

function CodeBlockWithCopy({
    children,
    ...props
}: React.ComponentPropsWithoutRef<"pre">) {
    const preRef = useRef<HTMLPreElement>(null)

    const handleCopy = async () => {
        const el = preRef.current
        if (!el) return
        const text = el.textContent ?? ""
        try {
            await navigator.clipboard.writeText(text)
            toast.success("已复制")
        } catch {
            toast.error("复制失败")
        }
    }

    return (
        <div className="relative group mt-2 mb-4">
            <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute right-2 top-2 opacity-80 hover:opacity-100 z-10 h-8"
                onClick={handleCopy}
            >
                <Copy className="size-4 mr-1" />
                复制
            </Button>
            <pre ref={preRef} {...props} className="pr-24 pt-10 pb-3 pl-4 overflow-x-auto rounded-md border bg-muted/50 text-sm">
                {children}
            </pre>
        </div>
    )
}

const proseClass =
    "prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc"

export function GuideMarkdownView({ content }: GuideMarkdownViewProps) {
    if (!content?.trim()) return null

    return (
        <div className={proseClass}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    pre: CodeBlockWithCopy,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}
