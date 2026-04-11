"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MessageCircle, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MarkdownView } from "@/app/components/markdown-view"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"

function stripToolCallArtifacts(text: string): string {
    return text
        // Complete blocks
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
        // Incomplete block (streaming: opened but not yet closed)
        .replace(/<tool_call>[\s\S]*/g, "")
        // Stray closing tag
        .replace(/<\/tool_call>/g, "")
        // Orphaned braces on their own line (JSON remnants)
        .replace(/^\s*[{}]\s*$/gm, "")
        .trim()
}

function MessageBubble({ message }: { message: UIMessage }) {
    const isUser = message.role === "user"
    const rawText = message.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("")
    const textContent = isUser ? rawText : stripToolCallArtifacts(rawText)

    return (
        <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
            >
                {isUser ? (
                    textContent
                ) : (
                    <MarkdownView content={textContent} />
                )}
            </div>
        </div>
    )
}

function ChatBody({
    messages,
    status,
    error,
    input,
    setInput,
    onSend,
    scrollRef,
}: {
    messages: UIMessage[]
    status: string
    error: Error | undefined
    input: string
    setInput: (v: string) => void
    onSend: () => void
    scrollRef: React.RefObject<HTMLDivElement | null>
}) {
    const isDisabled = status !== "ready"

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            if (!isDisabled && input.trim()) onSend()
        }
    }

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-3"
            >
                {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center mt-6 px-2">
                        你好！我是 AI 助手，有什么可以帮你的？
                    </p>
                )}
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                ))}
                {error && (
                    <div className="mb-2 flex justify-start">
                        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-destructive/10 text-destructive">
                            {error.message || "请求失败，请稍后重试。"}
                        </div>
                    </div>
                )}
                {status === "submitted" && (
                    <div className="flex justify-start mb-2">
                        <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                            <span className="inline-flex gap-1">
                                <span className="animate-pulse">●</span>
                                <span className="animate-pulse [animation-delay:150ms]">●</span>
                                <span className="animate-pulse [animation-delay:300ms]">●</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>
            <div className="border-t px-3 pt-2 pb-2 shrink-0">
                <div className="flex gap-2 items-end">
                    <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入问题，Enter 发送…"
                        className="resize-none min-h-10 max-h-30 text-sm"
                        rows={1}
                        disabled={isDisabled}
                    />
                    <Button
                        type="button"
                        size="icon"
                        onClick={onSend}
                        disabled={isDisabled || !input.trim()}
                    >
                        <Send className="size-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

export function FloatingChat() {
    const [open, setOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches)
    const [input, setInput] = useState("")
    const scrollRef = useRef<HTMLDivElement>(null)

    // Chat panel drag state: null = use default CSS position (bottom-24 right-6)
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)
    const dragOrigin = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)

    // Trigger button drag state
    const [btnPos, setBtnPos] = useState<{ x: number; y: number } | null>(null)
    const btnRef = useRef<HTMLDivElement>(null)
    const btnDragOrigin = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)
    const btnDragged = useRef(false)

    const { messages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({ api: "/api/distributor/ai-chat" }),
    })

    // Detect mobile (safe: component is dynamically imported with ssr:false)
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)")
        const fn = (e: MediaQueryListEvent) => setIsMobile(e.matches)
        mq.addEventListener("change", fn)
        return () => mq.removeEventListener("change", fn)
    }, [])

    // Auto-scroll to latest message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, status])

    // Reset position when panel is closed
    useEffect(() => {
        if (!open) setPos(null)
    }, [open])

    const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!cardRef.current) return
        const rect = cardRef.current.getBoundingClientRect()
        dragOrigin.current = { px: e.clientX, py: e.clientY, cx: rect.left, cy: rect.top }
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragOrigin.current || !cardRef.current) return
        const dx = e.clientX - dragOrigin.current.px
        const dy = e.clientY - dragOrigin.current.py
        const { width, height } = cardRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(window.innerWidth - width, dragOrigin.current.cx + dx))
        const y = Math.max(0, Math.min(window.innerHeight - height, dragOrigin.current.cy + dy))
        setPos({ x, y })
    }

    const handleDragEnd = () => {
        dragOrigin.current = null
    }

    const handleBtnDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!btnRef.current) return
        const rect = btnRef.current.getBoundingClientRect()
        btnDragOrigin.current = { px: e.clientX, py: e.clientY, cx: rect.left, cy: rect.top }
        btnDragged.current = false
        e.currentTarget.setPointerCapture(e.pointerId)
    }

    const handleBtnDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!btnDragOrigin.current || !btnRef.current) return
        const dx = e.clientX - btnDragOrigin.current.px
        const dy = e.clientY - btnDragOrigin.current.py
        if (!btnDragged.current && Math.hypot(dx, dy) < 5) return
        btnDragged.current = true
        const { width, height } = btnRef.current.getBoundingClientRect()
        // On mobile: keep above the bottom nav (64px) + safe-area-inset-bottom
        const safeAreaBottom = isMobile
            ? 64 + (parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sab") || "0", 10) || 0)
            : 0
        const x = Math.max(0, Math.min(window.innerWidth - width, btnDragOrigin.current.cx + dx))
        const y = Math.max(0, Math.min(window.innerHeight - height - safeAreaBottom, btnDragOrigin.current.cy + dy))
        setBtnPos({ x, y })
    }

    const handleBtnDragEnd = () => {
        if (!btnDragged.current) setOpen(true)
        btnDragOrigin.current = null
    }

    const handleSend = () => {
        if (!input.trim() || status !== "ready") return
        sendMessage({ text: input })
        setInput("")
    }

    const chatBodyProps = { messages, status, error, input, setInput, onSend: handleSend, scrollRef }

    return (
        <>
            {/* Desktop: floating card panel — draggable */}
            {!isMobile && open && (
                <div
                    ref={cardRef}
                    className={cn(
                        "fixed z-50 w-110 h-150 min-w-72 min-h-80 max-w-[90vw] max-h-[80vh] flex flex-col shadow-xl rounded-xl border bg-card text-card-foreground resize overflow-hidden",
                        !pos && "bottom-24 right-6"
                    )}
                    style={pos ? { left: pos.x, top: pos.y } : undefined}
                >
                    <div
                        className="flex flex-row items-center justify-between py-3 px-4 border-b shrink-0 cursor-grab active:cursor-grabbing select-none"
                        onPointerDown={handleDragStart}
                        onPointerMove={handleDragMove}
                        onPointerUp={handleDragEnd}
                    >
                        <span className="font-semibold text-sm">AI 助手</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setOpen(false)}
                            onPointerDown={(e) => e.stopPropagation()}
                            aria-label="关闭"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                    <div className="flex-1 p-0 min-h-0">
                        <ChatBody {...chatBodyProps} />
                    </div>
                </div>
            )}

            {/* Floating trigger button — draggable; bottom-20 on mobile to clear the 64px nav bar */}
            {!open && (
                <div
                    ref={btnRef}
                    className={cn(
                        "fixed z-50 size-14 cursor-grab active:cursor-grabbing touch-none",
                        !btnPos && "bottom-20 right-6 md:bottom-6"
                    )}
                    style={btnPos ? { left: btnPos.x, top: btnPos.y } : undefined}
                    onPointerDown={handleBtnDragStart}
                    onPointerMove={handleBtnDragMove}
                    onPointerUp={handleBtnDragEnd}
                    aria-label="打开 AI 助手"
                >
                    <Button className="size-14 rounded-full shadow-lg pointer-events-none" tabIndex={-1}>
                        <MessageCircle className="size-6" />
                    </Button>
                </div>
            )}

            {/* Mobile: bottom sheet */}
            {isMobile && (
                <Sheet open={open} onOpenChange={setOpen}>
                    <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col supports-[padding-bottom:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]">
                        <SheetHeader className="py-3 px-4 border-b shrink-0">
                            <SheetTitle className="text-sm">AI 助手</SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 min-h-0">
                            <ChatBody {...chatBodyProps} />
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </>
    )
}
