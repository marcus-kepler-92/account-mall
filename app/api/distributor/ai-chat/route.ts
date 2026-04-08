import { type NextRequest } from "next/server"
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getDistributorSession } from "@/lib/auth-guard"
import { config } from "@/lib/config"
import { checkAiChatRateLimit } from "@/lib/rate-limit"
import { buildSystemPrompt, buildTools, fetchDistributorContext, fetchPlatformContext } from "@/lib/ai-distributor"

const MAX_MESSAGE_LENGTH = 500
const MAX_CONTEXT_MESSAGES = 10

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = session.user as { id: string; name: string }

  const rateLimitResponse = await checkAiChatRateLimit(user.id)
  if (rateLimitResponse) return rateLimitResponse

  const { messages }: { messages: UIMessage[] } = await request.json()

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")
  const lastTextContent =
    lastUserMessage?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ?? ""

  if (lastTextContent.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "消息过长，请控制在 500 字以内。" }, { status: 400 })
  }

  const trimmedMessages = messages.slice(-MAX_CONTEXT_MESSAGES)

  const qwen = createOpenAI({
    baseURL: "https://api.siliconflow.com/v1",
    apiKey: config.qwenApiKey ?? "",
  })

  const [distributorCtx, platformCtx] = await Promise.all([
    fetchDistributorContext(user.id),
    fetchPlatformContext(),
  ])

  const result = streamText({
    model: qwen.chat("Qwen/Qwen2.5-72B-Instruct"),
    system: buildSystemPrompt(distributorCtx, platformCtx, user.name ?? "分销员"),
    messages: await convertToModelMessages(trimmedMessages),
    tools: buildTools(user.id),
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
