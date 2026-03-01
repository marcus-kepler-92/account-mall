/**
 * Utilities for product description: format detection, plain-text summary, and Markdown stripping.
 */

/** Heuristic: content looks like HTML (e.g. from legacy TipTap). */
export function isLikelyHtml(value: string | null | undefined): boolean {
    if (!value || typeof value !== "string") return false
    const trimmed = value.trim()
    return /<[a-z][\s\S]*>/i.test(trimmed) || trimmed.includes("</")
}

/**
 * Strip Markdown syntax to plain text (for previews, SEO, meta).
 * Handles common patterns: headers, bold/italic, links, code, lists.
 */
export function stripMarkdown(md: string): string {
    if (!md || typeof md !== "string") return ""
    let s = md
    // Code blocks (multiline)
    s = s.replace(/```[\s\S]*?```/g, " ")
    // Inline code
    s = s.replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    // Links: [text](url) -> text
    s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Images: ![alt](url) -> alt
    s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Headers: ### text -> text
    s = s.replace(/^#{1,6}\s+/gm, "")
    // Bold/italic
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1")
    s = s.replace(/\*([^*]+)\*/g, "$1")
    s = s.replace(/__([^_]+)__/g, "$1")
    s = s.replace(/_([^_]+)_/g, "$1")
    // Strikethrough
    s = s.replace(/~~([^~]+)~~/g, "$1")
    // List markers
    s = s.replace(/^\s*[-*+]\s+/gm, "")
    s = s.replace(/^\s*\d+\.\s+/gm, "")
    // Blockquote
    s = s.replace(/^\s*>\s+/gm, "")
    // Horizontal rule
    s = s.replace(/^[-*_]{3,}\s*$/gm, " ")
    // Collapse whitespace
    s = s.replace(/\s+/g, " ").trim()
    return s
}

/**
 * Get plain text from description for cards, meta, jsonLd.
 * Handles both legacy HTML and Markdown.
 */
export function descriptionToPlainText(
    description: string | null | undefined,
    maxLength: number
): string {
    if (!description || typeof description !== "string") return ""
    const plain = isLikelyHtml(description)
        ? description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : stripMarkdown(description)
    return plain.slice(0, maxLength)
}
