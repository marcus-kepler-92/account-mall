import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { isLikelyHtml } from "@/lib/description"
import { MarkdownViewClient } from "@/app/components/markdown-view-client"

// Server-rendered product description. The shared MarkdownViewClient loads
// its renderer with `ssr: false`, which leaves the product page's main copy
// out of the initial HTML — crawlers that don't execute JS (Bing, Baidu, AI
// answer engines) then see a page with only a title and a price. Rendering
// here ships the full text in the HTML response.

const proseClass =
  "prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc [&_img]:rounded-lg"

export function ProductDescription({ content, productName }: { content: string; productName: string }) {
  if (!content.trim()) return null

  // Legacy TipTap HTML needs DOMPurify, which on the server means bundling
  // jsdom into this route. No live product uses HTML any more, so keep that
  // rare path on the existing client renderer.
  if (isLikelyHtml(content)) return <MarkdownViewClient content={content} />

  return (
    <div className={proseClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Do NOT spread react-markdown's props — it passes a non-DOM `node`.
          img: ({ src, alt, title }) =>
            typeof src === "string" && src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt || productName} title={title} loading="lazy" />
            ) : null,
          // The page H1 is the product name; demote in-description headings so
          // the document keeps a single H1.
          h1: ({ children }) => <h2>{children}</h2>,
          // Site-relative links pass link equity to our own pages; external
          // ones open in a new tab and stay nofollow.
          a: ({ href, children }) =>
            href?.startsWith("/") ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {children}
              </a>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
