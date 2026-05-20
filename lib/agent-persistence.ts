import { unstable_cache } from "next/cache"
import { type UIMessage } from "ai"
import { extractTextParts } from "@/lib/agent-utils"
import { prisma } from "@/lib/prisma"

// Cached PUBLISHED knowledge list. Tag-invalidated by admin write paths
// via revalidateTag("agent-knowledge"). MVP uses unstable_cache because
// "use cache: remote" requires cacheComponents:true, which conflicts
// with 100+ existing route-segment force-dynamic / runtime exports.
// Spec §15 risk table predicted this fallback.
export const fetchPublishedKnowledge = unstable_cache(
  async () => {
    return prisma.agentKnowledge.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        tags: true,
      },
    })
  },
  ["agent-knowledge-published"],
  { revalidate: 3600, tags: ["agent-knowledge"] },
)

// Cached ACTIVE product index — injected into the agent's system prompt so the
// LLM can do semantic matching by name/summary/tags before calling
// lookup_product (which is now ID-only). Invalidated alongside the existing
// storefront "products" tag so admin writes already trigger refresh.
export const fetchActiveProducts = unstable_cache(
  async () => {
    return prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 50,
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        price: true,
        productType: true,
        tags: { select: { name: true } },
      },
    })
  },
  ["agent-active-products"],
  { revalidate: 600, tags: ["products", "agent-active-products"] },
)

// Server-side validate a list of orderNos the client claims to have in their
// localStorage. We only return orders that actually exist — fabricated hints
// are silently dropped. Capped at MAX_ORDER_HINTS to bound DB load and prompt
// size. The output is intentionally a small, safe subset (no card content,
// no token, no email).
const MAX_ORDER_HINTS = 5
export async function fetchUserOrdersByHints(
  orderHints: string[] | undefined,
): Promise<Array<{
  orderNo: string
  product: string
  status: "PENDING" | "COMPLETED" | "CLOSED"
  paidAt: string | null
}>> {
  if (!orderHints || orderHints.length === 0) return []
  // De-duplicate, sanitize, cap. Same length/regex bounds as lookup_order tool.
  const safe = Array.from(
    new Set(
      orderHints
        .filter((s) => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length >= 6 && s.length <= 40),
    ),
  ).slice(0, MAX_ORDER_HINTS)
  if (safe.length === 0) return []
  const rows = await prisma.order.findMany({
    where: { orderNo: { in: safe } },
    orderBy: { createdAt: "desc" },
    select: {
      orderNo: true,
      status: true,
      productNameSnapshot: true,
      paidAt: true,
    },
  })
  return rows.map((r) => ({
    orderNo: r.orderNo,
    product: r.productNameSnapshot ?? "(未命名商品)",
    status: r.status as "PENDING" | "COMPLETED" | "CLOSED",
    paidAt: r.paidAt?.toISOString().slice(0, 10) ?? null,
  }))
}

export async function persistUserMessage(
  sessionId: string,
  message: UIMessage,
): Promise<void> {
  await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "USER",
      parts: message.parts as never,
      contentText: extractTextParts(message.parts),
    },
  })
}

export async function persistToolStep(
  sessionId: string,
  step: { toolCalls?: Array<{ toolName: string }> },
): Promise<void> {
  if (!step.toolCalls?.length) return
  for (const call of step.toolCalls) {
    await prisma.agentMessage.create({
      data: {
        sessionId,
        role: "TOOL",
        toolName: call.toolName,
        parts: call as never,
        contentText: `[tool: ${call.toolName}]`,
      },
    })
  }
}

export async function persistAssistantMessage(
  sessionId: string,
  responseMessages: Array<{ role: string; content: unknown }>,
  usage: { promptTokens?: number; completionTokens?: number },
  citations?: string[],
): Promise<void> {
  const assistant = responseMessages.findLast((m) => m.role === "assistant")
  if (!assistant) return

  // Cannot delegate to extractTextParts: assistant.content is `unknown` from
  // the AI SDK response shape (provider-dependent), not UIMessage["parts"].
  // The narrowing predicate here is intentionally looser.
  const contentArr = Array.isArray(assistant.content) ? assistant.content : []
  const text = contentArr
    .filter((p: unknown): p is { type: "text"; text: string } => {
      return (p as { type?: string }).type === "text"
    })
    .map((p) => p.text)
    .join("")

  await prisma.agentMessage.create({
    data: {
      sessionId,
      role: "ASSISTANT",
      parts: assistant.content as never,
      contentText: text,
      citations: citations?.length ? (citations as never) : undefined,
      inputTokens: usage.promptTokens ?? 0,
      outputTokens: usage.completionTokens ?? 0,
    },
  })
}
