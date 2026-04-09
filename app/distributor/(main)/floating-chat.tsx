"use client"

import { useState, useEffect, useRef } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { MessageCircle, X, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { MarkdownView } from "@/app/components/markdown-view"
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

    const handleSend = () => {
        if (!input.trim() || status !== "ready") return
        sendMessage({ text: input })
        setInput("")
    }

    const chatBodyProps = { messages, status, error, input, setInput, onSend: handleSend, scrollRef }

    return (
        <>
            {/* Desktop: floating card panel — shown above trigger */}
            {!isMobile && open && (
                <Card className="fixed bottom-24 right-6 z-50 w-110 h-150 min-w-72 min-h-80 max-w-[90vw] max-h-[80vh] flex flex-col shadow-xl py-0 resize overflow-hidden">
                    <div className="flex flex-row items-center justify-between py-3 px-4 border-b shrink-0">
                        <span className="font-semibold text-sm">AI 助手</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => setOpen(false)}
                            aria-label="关闭"
                        >
                            <X className="size-4" />
                        </Button>
                    </div>
                    <CardContent className="flex-1 p-0 min-h-0">
                        <ChatBody {...chatBodyProps} />
                    </CardContent>
                </Card>
            )}

            {/* Floating trigger button — only show when panel is closed */}
            {!open && (
                <Button
                    className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg"
                    onClick={() => setOpen(true)}
                    aria-label="打开 AI 助手"
                >
                    <MessageCircle className="size-6" />
                </Button>
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
