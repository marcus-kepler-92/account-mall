"use client"

import {
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
} from "@assistant-ui/react-markdown"
import remarkGfm from "remark-gfm"
import { memo } from "react"
import { cn } from "@/lib/utils"

// Compact markdown components tuned for the chat bubble. Smaller margins than
// the official sample because we render inside a `max-w-[85%]` muted bubble.
// dot.css (imported in app/layout.tsx) injects the streaming caret at the end
// of the last text node while `data-status="running"`.
const components = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1 className={cn("mt-2 mb-1 text-base font-semibold first:mt-0 last:mb-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-2 mb-1 text-sm font-semibold first:mt-0 last:mb-0", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-1.5 mb-0.5 text-sm font-semibold first:mt-0 last:mb-0", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-1.5 leading-normal first:mt-0 last:mb-0", className)} {...props} />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn("text-primary underline underline-offset-2 hover:text-primary/80", className)}
      target="_blank"
      rel="noopener noreferrer nofollow"
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-1 ms-4 list-disc [&>li]:mt-0.5", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-1 ms-4 list-decimal [&>li]:mt-0.5", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "my-1.5 border-s-2 border-muted-foreground/30 ps-3 italic text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, ...props }) => (
    <code
      className={cn(
        "rounded bg-background/70 px-1 py-0.5 text-[0.85em] font-mono",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-1.5 overflow-auto rounded-md bg-background/70 p-2 [&_code]:bg-transparent [&_code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-2 border-muted-foreground/20", className)} {...props} />
  ),
})

// smooth={false}: disable assistant-ui's character-level fade-in animation.
//
// With smooth=true the primitive maintains an internal text buffer that drains
// via setInterval; on Cancel the underlying stream aborts but that buffer keeps
// playing, leaving `data-status="running"` on the container — which means
// dot.css's blinking caret never disappears and the Composer stays stuck in
// "stopping" state. Token-level streaming from streamText still gives a
// visible typewriter feel without the runaway buffer.
const MarkdownTextImpl = () => (
  <MarkdownTextPrimitive smooth={false} remarkPlugins={[remarkGfm]} className="aui-md" components={components} />
)

export const MarkdownText = memo(MarkdownTextImpl)
