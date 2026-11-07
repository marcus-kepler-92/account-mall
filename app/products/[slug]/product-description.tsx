import { isLikelyHtml } from "@/lib/description"
import { MarkdownViewClient } from "@/app/components/markdown-view-client"
import { ServerMarkdown } from "@/app/components/server-markdown"

// Server-rendered product description. The shared MarkdownViewClient loads
// its renderer with `ssr: false`, which leaves the product page's main copy
// out of the initial HTML — crawlers that don't execute JS (Bing, Baidu, AI
// answer engines) then see a page with only a title and a price.

export function ProductDescription({ content, productName }: { content: string; productName: string }) {
  if (!content.trim()) return null

  // Legacy TipTap HTML needs DOMPurify, which on the server means bundling
  // jsdom into this route. No live product uses HTML any more, so keep that
  // rare path on the existing client renderer.
  if (isLikelyHtml(content)) return <MarkdownViewClient content={content} />

  return <ServerMarkdown content={content} fallbackAlt={productName} />
}
