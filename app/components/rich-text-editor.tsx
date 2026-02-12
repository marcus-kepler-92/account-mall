"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Bold, Italic, List, ListOrdered, Undo, Redo } from "lucide-react"
import { cn } from "@/lib/utils"

type RichTextEditorProps = {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function RichTextEditor({
    value,
    onChange,
    placeholder = "输入内容...",
    className,
    disabled,
}: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({ placeholder }),
        ],
        content: value || "",
        editable: !disabled,
        immediatelyRender: false, // Avoid hydration mismatch in Next.js SSR
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })

    if (!editor) return null

    return (
        <div
            className={cn(
                "rounded-md border overflow-hidden",
                "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
        >
            <div className="flex items-center gap-1 border-b bg-muted/50 p-1">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    data-active={editor.isActive("bold") ? "true" : undefined}
                >
                    <Bold className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    data-active={editor.isActive("italic") ? "true" : undefined}
                >
                    <Italic className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    data-active={editor.isActive("bulletList") ? "true" : undefined}
                >
                    <List className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    data-active={editor.isActive("orderedList") ? "true" : undefined}
                >
                    <ListOrdered className="size-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().chain().focus().undo().run()}
                >
                    <Undo className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().chain().focus().redo().run()}
                >
                    <Redo className="size-4" />
                </Button>
            </div>
            <EditorContent
                editor={editor}
                className="min-h-[120px] px-3 py-2 [&_.ProseMirror]:min-h-[100px] [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
            />
        </div>
    )
}
