import { parseCardContentWithDelimiter } from "@/lib/auto-fetch-card"

export interface ParsedFormat {
  delimiter: string
  fields: string[]
}

export type ResolvedCard =
  | { type: "formatted"; fields: { label: string; value: string }[] }
  | { type: "plain"; content: string }

/**
 * Parse a template string like "{账号}----{密码}----{生日}" into delimiter and
 * ordered field names. Returns null if fewer than 2 placeholders or no delimiter.
 */
export function parseTemplate(template: string): ParsedFormat | null {
  const matches = [...template.matchAll(/\{([^}]+)\}/g)]
  if (matches.length < 2) return null

  const fields = matches.map((m) => m[1])
  const firstEnd = matches[0].index! + matches[0][0].length
  const secondStart = matches[1].index!
  const delimiter = template.slice(firstEnd, secondStart)

  if (!delimiter) return null

  return { delimiter, fields }
}

// Maps AutoFetchCardPayload keys to display labels for the heuristic path
const PAYLOAD_DISPLAY_LABELS: [string, string][] = [
  ["account", "账号"],
  ["password", "密码"],
  ["securityAnswerFriend", "密保朋友"],
  ["securityAnswerWork", "工作答案"],
  ["securityAnswerParents", "父母答案"],
  ["birthday", "生日"],
]

// Guard: only apply heuristic when content contains recognizable label prefixes
const LABEL_PATTERN = /账号|密码|password|account/i

/**
 * Resolve card content to labeled fields using three-tier logic:
 * 1. Match against configured product formats (delimiter + field count)
 * 2. Label-based heuristic for self-labeled content (e.g. "账号xxx----密码xxx")
 * 3. Plain text fallback
 */
export function resolveCardFields(
  content: string,
  formats: Array<{ template: string }>
): ResolvedCard {
  const trimmed = content.trim()

  // Tier 1: configured formats
  for (const fmt of formats) {
    const parsed = parseTemplate(fmt.template)
    if (!parsed) continue
    const parts = trimmed.split(parsed.delimiter).map((p) => p.trim())
    if (parts.length === parsed.fields.length && parts.every((p) => p !== "")) {
      return {
        type: "formatted",
        fields: parsed.fields.map((label, i) => ({ label, value: parts[i] })),
      }
    }
  }

  // Tier 2: label-based heuristic (only when content has recognizable label prefixes)
  if (LABEL_PATTERN.test(trimmed)) {
    const payload = parseCardContentWithDelimiter(trimmed, null)
    if (payload) {
      const fields: { label: string; value: string }[] = []
      for (const [key, label] of PAYLOAD_DISPLAY_LABELS) {
        const val = (payload as unknown as Record<string, unknown>)[key]
        if (typeof val === "string" && val && val !== "未知") {
          fields.push({ label, value: val })
        }
      }
      if (fields.length >= 2) {
        return { type: "formatted", fields }
      }
    }
  }

  // Tier 3: plain text
  return { type: "plain", content: trimmed }
}
