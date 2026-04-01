"use client"

import dynamic from "next/dynamic"
import { useRef, useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"
import type { EditorRef } from "react-email-editor"

const EmailEditor = dynamic(() => import("react-email-editor"), {
  ssr: false,
  loading: () => <Skeleton className="w-full" style={{ minHeight: 600 }} />,
})

export type UnlayerEditorHandle = {
  exportHtml: () => Promise<{ design: Record<string, unknown>; html: string }>
}

type Props = {
  initialDesign?: Record<string, unknown>
  onReady?: () => void
  editorRef: React.RefObject<UnlayerEditorHandle | null>
}

export function UnlayerEditor({ initialDesign, onReady, editorRef }: Props) {
  const internalRef = useRef<EditorRef>(null)
  const [ready, setReady] = useState(false)

  // Expose exportHtml via the forwarded ref
  useEffect(() => {
    if (editorRef && "current" in editorRef) {
      (editorRef as React.MutableRefObject<UnlayerEditorHandle | null>).current = {
        exportHtml: () =>
          new Promise((resolve, reject) => {
            if (!internalRef.current?.editor) {
              reject(new Error("Editor not ready"))
              return
            }
            internalRef.current.editor.exportHtml(({ design, html }) => {
              resolve({ design: design as Record<string, unknown>, html })
            })
          }),
      }
    }
  }, [editorRef, ready])

  const handleReady = () => {
    setReady(true)
    if (initialDesign && Object.keys(initialDesign).length > 0) {
      internalRef.current?.editor?.loadDesign(initialDesign as never)
    }
    onReady?.()
  }

  return (
    <div style={{ minHeight: 600 }} className="relative w-full border rounded-md overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted/60 backdrop-blur-sm">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">编辑器加载中…</p>
        </div>
      )}
      <EmailEditor
        ref={internalRef}
        onReady={handleReady}
        minHeight={600}
        options={{ displayMode: "email" }}
      />
    </div>
  )
}
