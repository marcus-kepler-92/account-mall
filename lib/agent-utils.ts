import { type UIMessage } from "ai"

/**
 * Concatenate all text-typed parts of a UIMessage.parts array.
 * Shared by agent-anti-abuse (for byte-cap check) and agent-persistence
 * (for contentText extraction) — keep in sync.
 */
export function extractTextParts(parts: UIMessage["parts"]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}
