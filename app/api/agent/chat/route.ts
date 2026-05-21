import { createOpenAI } from "@ai-sdk/openai"
import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
} from "ai"
import {
  applyAntiAbuse,
  reserveTokens,
  commitUsage,
  rollbackTokens,
  estimateTokens,
} from "@/lib/agent-anti-abuse"
import { buildCSPrompt, buildCSTools } from "@/lib/agent-cs"
import {
  persistUserMessage,
  persistToolStep,
  persistAssistantMessage,
  fetchPublishedKnowledge,
  fetchActiveProducts,
  fetchUserOrdersByHints,
} from "@/lib/agent-persistence"
import { config } from "@/lib/config"
import { getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"

// DeepSeek is OpenAI-compatible at https://api.deepseek.com.
// deepseek-chat = V4 Flash, non-thinking (cheap + prompt cache friendly).
// DeepSeek applies prompt caching automatically when prefix matches; no
// provider-specific option is required.
const deepseek = createOpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: config.deepseekApiKey,
})

// Detect dev-placeholder keys early so users see a clear server log instead
// of a silent stream failure later. DeepSeek keys look like sk-<32+ hex>.
const KEY_LOOKS_PLACEHOLDER =
  /placeholder|fake|test|example|dummy|change-?me/i.test(config.deepseekApiKey) ||
  config.deepseekApiKey.length < 30

export async function POST(req: Request) {
  if (KEY_LOOKS_PLACEHOLDER) {
    console.error(
      "[agent-chat] AGENT_NOT_CONFIGURED: DEEPSEEK_API_KEY looks like a " +
        "placeholder. Get a real key at https://platform.deepseek.com/api_keys " +
        "and set DEEPSEEK_API_KEY in .env.local",
    )
    // 503 让前端走 fallback QR (与其他不可用场景共享 UI), reason 字段
    // 仅在 server log / 调试时看. 用户看到的是中性"暂时不可用"文案,
    // 不会被"今日额度已达上限"误导.
    return Response.json(
      { error: "service-unavailable", reason: "agent-not-configured" },
      { status: 503 },
    )
  }

  const { messages, sessionId, orderHints } = (await req.json()) as {
    messages: UIMessage[]
    sessionId: string
    orderHints?: string[]
  }

  // 1. Anti-abuse: session validity, 4KB cap, rate limiters
  const guard = await applyAntiAbuse(req, sessionId, messages)
  if (!guard.ok) return guard.response

  // 2. Quota reserve (Redis pipeline; daily cap check)
  const estimated = estimateTokens(messages)
  const reserved = await reserveTokens(sessionId, estimated)
  if (!reserved.ok) return guard.fallbackResponse(reserved.reason)

  // 3. Persist incoming user message
  await persistUserMessage(sessionId, messages.at(-1)!)

  // 4. Pull knowledge + ACTIVE product index + user's verified recent orders +
  //    runtime site settings (for business-hours line in the system prompt)
  const [knowledge, products, userOrders, settings] = await Promise.all([
    fetchPublishedKnowledge(),
    fetchActiveProducts(),
    fetchUserOrdersByHints(orderHints),
    getSiteSettings(),
  ])

  const pad = (n: number) => String(n).padStart(2, "0")
  const businessHoursText = `${pad(settings.businessHoursStart)}:00 – ${pad(settings.businessHoursEnd)}:00（${settings.businessHoursTimezone}）`

  // 5. Track lookupKnowledge citations for AgentMessage.citations
  const citations: string[] = []

  // Sliding-window context: cap the chat history sent to the LLM at the
  // most recent MAX_LLM_HISTORY messages. This keeps per-turn token cost
  // bounded as a session grows — without it, turn N's input is
  // `system + all prior turns`, which scales O(N²) cumulatively and
  // exhausts the per-session budget after ~40 real exchanges.
  //
  // The UI thread keeps the full transcript (assistant-ui state +
  // /api/agent/messages on rehydrate); we just don't replay everything
  // to the model. The model treating older context as "forgotten" is
  // intentional — fits a customer-service flow where each issue is
  // usually scoped to the recent few turns.
  const MAX_LLM_HISTORY = 30
  const trimmedMessages =
    messages.length > MAX_LLM_HISTORY ? messages.slice(-MAX_LLM_HISTORY) : messages

  // AI SDK v6: convertToModelMessages returns Promise<ModelMessage[]>
  const modelMessages = await convertToModelMessages(trimmedMessages)

  // 6. Stream
  const result = streamText({
    model: deepseek.chat("deepseek-chat"),
    system: buildCSPrompt({
      knowledge,
      products,
      siteName: config.siteName,
      businessHoursText,
      userOrders,
    }),
    messages: modelMessages,
    tools: buildCSTools(sessionId),
    stopWhen: stepCountIs(5),
    abortSignal: AbortSignal.timeout(config.agentChatTimeoutMs),
    experimental_telemetry: { isEnabled: true, functionId: "agent-cs-chat" },
    // No providerOptions.gateway — direct connection, DeepSeek handles its own
    // prompt caching automatically when prefix matches.
    onStepFinish: async (step) => {
      // Collect knowledge IDs returned by lookupKnowledge so we can
      // persist them as citations on the assistant message.
      for (const tr of step.toolResults as Array<{ toolName: string; output?: unknown }>) {
        if (tr.toolName !== "lookupKnowledge" || !Array.isArray(tr.output)) continue
        for (const item of tr.output) {
          if (
            item &&
            typeof item === "object" &&
            "id" in item &&
            typeof (item as { id: unknown }).id === "string"
          ) {
            citations.push((item as { id: string }).id)
          }
        }
      }
      await persistToolStep(sessionId, step as never)
    },
    onFinish: async ({ usage, response }) => {
      // AI SDK v6 uses inputTokens/outputTokens; lib expects promptTokens/completionTokens.
      const mappedUsage = {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
      }
      await commitUsage(sessionId, estimated, mappedUsage)
      await persistAssistantMessage(
        sessionId,
        response.messages as never,
        mappedUsage,
        citations,
      )
    },
    onError: async ({ error }) => {
      // Surface DeepSeek / network failures to server logs — without this the
      // stream just dies silently and the user sees a blank assistant bubble.
      // Common causes: invalid DEEPSEEK_API_KEY, DeepSeek 5xx, AbortSignal timeout.
      const msg = error instanceof Error ? error.message : String(error)
      console.error(
        `[agent-chat] streamText error (session=${sessionId.slice(0, 8)}): ${msg}`,
        error,
      )
      await rollbackTokens(sessionId, estimated)
    },
  })

  return result.toUIMessageStreamResponse()
}
