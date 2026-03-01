"use client"

import "@uiw/react-md-editor/markdown-editor.css"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

type MarkdownEditorProps = {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    /** 编辑器区域高度（像素），默认 320 */
    height?: number
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder = "描述你的商品，支持 Markdown…",
    className,
    disabled,
    height = 320,
}: MarkdownEditorProps) {
    const { resolvedTheme } = useTheme()
    const colorMode = resolvedTheme === "dark" ? "dark" : "light"

    return (
        <div data-color-mode={colorMode} className={cn("w-full min-w-0", className)}>
            <MDEditor
                value={value}
                onChange={(v) => onChange(v ?? "")}
                height={height}
                visibleDragbar={false}
                preview="live"
                textareaProps={{
                    placeholder,
                    disabled,
                }}
                data-color-mode={colorMode}
            />
        </div>
    )
}
