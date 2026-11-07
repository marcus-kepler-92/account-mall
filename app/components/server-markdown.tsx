import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

// Server-rendered Markdown for indexable copy (product descriptions, guide
// articles). Rendering on the server ships the full text in the HTML response,
// so crawlers that don't execute JS (Bing, Baidu, AI answer engines) see it.

const proseClass =
  "prose prose-sm max-w-none dark:prose-invert [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:list-disc [&_img]:rounded-lg"

export function ServerMarkdown({
  content,
  fallbackAlt,
  className,
}: {
  content: string
  /** alt text for images that have none (e.g. the product or article title). */
  fallbackAlt: string
  className?: string
}) {
  return (
    <div className={className ? `${proseClass} ${className}` : proseClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Do NOT spread react-markdown's props — it passes a non-DOM `node`.
          img: ({ src, alt, title }) =>
            typeof src === "string" && src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={alt || fallbackAlt} title={title} loading="lazy" />
            ) : null,
          // The page already has its H1; demote in-body headings so the
          // document keeps a single H1.
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
