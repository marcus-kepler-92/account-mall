"use client"

import {
  MessagePrimitive,
  ComposerPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import { Send, Square, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { MarkdownText } from "./markdown-text"

// Split user / assistant bubbles into explicit components so we can register
// them via the non-deprecated `UserMessage` / `AssistantMessage` keys on
// ThreadPrimitive.Messages. The fallback `Message` key was leaving user
// messages unrendered in some v0.14 paths.
export function UserBubble() {
  return (
    <MessagePrimitive.Root className="group flex w-full flex-col gap-1 py-2">
      <div className="flex justify-end">
        <div className="max-w-[80%] min-w-0 whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

export function AssistantBubble() {
  return (
    <MessagePrimitive.Root className="group flex w-full flex-col gap-1 py-2">
      <div className="flex justify-start">
        <div className="max-w-[85%] min-w-0 rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm">
          <MessagePrimitive.Content
            components={{
              Text: MarkdownText,
              tools: {
                // Generic "working" badge while a tool is in flight; auto-
                // hides once the tool returns. We never expose toolName /
                // args / result — once the agent starts streaming text,
                // dot.css's caret takes over the visual cue.
                Fallback: ({ status }) => {
                  if (status?.type !== "running") return null
                  return (
                    <div className="my-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      <span>正在为您查询资料…</span>
                    </div>
                  )
                },
              },
            }}
          />
        </div>
      </div>
      {/* ActionBar (copy / thumbs up / thumbs down) intentionally removed —
          customer-facing chat doesn't need these affordances, and the
          /api/agent/message-feedback hook stays wired in chat-panel.tsx
          for if we want to bring them back later. */}
    </MessagePrimitive.Root>
  )
}

// Composer bar: textarea + escalate + send/cancel.
// Send/Cancel are toggled via ComposerPrimitive.If running.
//
// `pb-[max(...)]` keeps the bar clear of the iPhone home indicator
// when no keyboard is open. The Sheet wrapper handles keyboard inset
// separately via useKeyboardInset (see customer-service-fab.tsx) so
// we don't double-pad while typing.
export function ComposerBar() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t bg-background p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* text-base on mobile avoids iOS auto-zoom (<16px triggers it); md: drops back to 14px for desktop density */}
      <ComposerPrimitive.Input
        autoFocus
        rows={1}
        className={cn(
          "max-h-32 min-h-10 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-base md:text-sm",
          "outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring",
        )}
        placeholder="输入您的问题…"
      />
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:brightness-110 disabled:opacity-40 md:size-9"
          aria-label="发送"
        >
          <Send className="size-4" />
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/80 md:size-9"
          aria-label="停止生成"
        >
          <Square className="size-4" />
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </ComposerPrimitive.Root>
  )
}
