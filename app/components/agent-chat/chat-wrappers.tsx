"use client"

import {
  MessagePrimitive,
  ComposerPrimitive,
  ActionBarPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react"
import { Send, Square, Copy, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
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
      {/* Mobile lacks hover; default to visible at <md and hover-reveal at ≥md. */}
      <ActionBarPrimitive.Root
        hideWhenRunning
        autohide="not-last"
        autohideFloat="single-branch"
        className="flex gap-1 pl-2 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 data-[floating]:opacity-100"
      >
        <ActionBarPrimitive.Copy className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:p-1">
          <Copy className="size-4 md:size-3.5" />
        </ActionBarPrimitive.Copy>
        <ActionBarPrimitive.FeedbackPositive className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground data-[active]:text-primary md:p-1">
          <ThumbsUp className="size-4 md:size-3.5" />
        </ActionBarPrimitive.FeedbackPositive>
        <ActionBarPrimitive.FeedbackNegative className="rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground data-[active]:text-destructive md:p-1">
          <ThumbsDown className="size-4 md:size-3.5" />
        </ActionBarPrimitive.FeedbackNegative>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

// Composer bar: textarea + escalate + send/cancel.
// Send/Cancel are toggled via ComposerPrimitive.If running.
export function ComposerBar() {
  return (
    <ComposerPrimitive.Root className="flex items-end gap-2 border-t bg-background p-2">
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
