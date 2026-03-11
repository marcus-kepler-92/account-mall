"use client"

import "@uiw/react-md-editor/markdown-editor.css"
import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useRef, useMemo } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getCommands, type ICommand } from "@uiw/react-md-editor/commands"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

const UPLOAD_IMAGE_URL = "/api/upload/image"
const IMAGE_MAX_BYTES = 2 * 1024 * 1024 // 2MB

type MarkdownEditorProps = {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    /** 编辑器区域高度（像素），默认 320 */
    height?: number
    /** 启用「插入图片」并上传到服务器；传入 pathPrefix 用于存储路径（如 guides/products） */
    imageUpload?: { pathPrefix: string }
}

function createImageUploadCommand(
    pathPrefix: string,
    inputRef: React.RefObject<HTMLInputElement | null>,
    apiRef: React.MutableRefObject<{ replaceSelection: (text: string) => void } | null>
): ICommand {
    return {
        name: "image",
        keyCommand: "image",
        buttonProps: {
            "aria-label": "插入图片",
            title: "插入图片（上传到服务器）",
        },
        icon: (
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path d="M15 9c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4-7H1c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h18c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1zm-1 13l-6-5-2 2-4-5-4 8V4h16v11z" />
            </svg>
        ),
        execute(_state, api) {
            apiRef.current = api
            inputRef.current?.click()
        },
    }
}

export function MarkdownEditor({
    value,
    onChange,
    placeholder = "描述你的商品，支持 Markdown…",
    className,
    disabled,
    height = 320,
    imageUpload,
}: MarkdownEditorProps) {
    const { resolvedTheme } = useTheme()
    const colorMode = resolvedTheme === "dark" ? "dark" : "light"
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const apiRef = useRef<{ replaceSelection: (text: string) => void } | null>(null)

    const commands = useMemo(() => {
        if (!imageUpload?.pathPrefix) return undefined
        const defaultCommands = getCommands()
        const uploadCmd = createImageUploadCommand(
            imageUpload.pathPrefix,
            fileInputRef,
            apiRef
        )
        return defaultCommands.map((cmd) => (cmd.name === "image" ? uploadCmd : cmd))
    }, [imageUpload?.pathPrefix])

    const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ""
        if (!file || !file.type.startsWith("image/")) {
            toast.error("请选择图片文件")
            return
        }
        if (file.size > IMAGE_MAX_BYTES) {
            toast.error("图片大小不能超过 2MB")
            return
        }
        const pathPrefix = imageUpload?.pathPrefix ?? "products"
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("pathPrefix", pathPrefix)
            const res = await fetch(UPLOAD_IMAGE_URL, { method: "POST", body: formData })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                toast.error(data.error ?? "图片上传失败")
                return
            }
            const { url } = (await res.json()) as { url?: string }
            if (url && apiRef.current) {
                const alt = file.name.replace(/\.[^.]+$/, "") || "image"
                apiRef.current.replaceSelection(`![${alt}](${url})`)
                apiRef.current = null
            }
        } catch {
            toast.error("图片上传失败")
        }
    }

    return (
        <div data-color-mode={colorMode} className={cn("md-editor-wrapper w-full min-w-0", className)}>
            {imageUpload && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    aria-hidden
                    onChange={handleImageFile}
                />
            )}
            <MDEditor
                value={value}
                onChange={(v) => onChange(v ?? "")}
                height={height}
                visibleDragbar={false}
                preview="live"
                commands={commands}
                textareaProps={{
                    placeholder,
                    disabled,
                }}
                data-color-mode={colorMode}
            />
        </div>
    )
}
