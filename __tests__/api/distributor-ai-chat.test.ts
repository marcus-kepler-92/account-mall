import { type NextRequest } from "next/server"
import { POST } from "@/app/api/distributor/ai-chat/route"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    checkAiChatRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: { qwenApiKey: "test-key" },
}))

jest.mock("@/lib/ai-distributor", () => ({
    __esModule: true,
    buildSystemPrompt: jest.fn().mockReturnValue("system prompt"),
    buildTools: jest.fn().mockReturnValue({}),
}))

jest.mock("ai", () => ({
    __esModule: true,
    streamText: jest.fn().mockReturnValue({
        toUIMessageStreamResponse: jest.fn().mockReturnValue(new Response("stream", { status: 200 })),
    }),
    tool: jest.fn((t: unknown) => t),
    stepCountIs: jest.fn((n: number) => n),
    convertToModelMessages: jest.fn(async (msgs: unknown) => msgs),
}))

jest.mock("@ai-sdk/openai", () => ({
    __esModule: true,
    createOpenAI: jest.fn().mockReturnValue(jest.fn()),
}))

import { getDistributorSession } from "@/lib/auth-guard"
import { checkAiChatRateLimit } from "@/lib/rate-limit"
import { streamText } from "ai"

function makeRequest(body: unknown): NextRequest {
    return { json: async () => body } as unknown as NextRequest
}

// UIMessage format: { id, role, parts: [{ type: "text", text: "..." }] }
function makeMessages(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: `msg_${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        parts: [{ type: "text", text: `message ${i}` }],
    }))
}

const sessionMock = getDistributorSession as jest.Mock
const rateLimitMock = checkAiChatRateLimit as jest.Mock
const streamTextMock = streamText as jest.Mock

beforeEach(() => {
    sessionMock.mockReset()
    rateLimitMock.mockReset()
    streamTextMock.mockReset()
    rateLimitMock.mockResolvedValue(null)
    streamTextMock.mockReturnValue({
        toUIMessageStreamResponse: jest.fn().mockReturnValue(new Response("stream", { status: 200 })),
    })
})

describe("POST /api/distributor/ai-chat", () => {
    it("returns 401 when not authenticated", async () => {
        sessionMock.mockResolvedValueOnce(null)

        const res = await POST(makeRequest({ messages: [] }))

        expect(res.status).toBe(401)
        const data = await res.json()
        expect(data).toEqual({ error: "Unauthorized" })
    })

    it("returns 429 when rate limited", async () => {
        sessionMock.mockResolvedValueOnce({ user: { id: "user_1", name: "Test" } })
        rateLimitMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "AI 对话请求过于频繁，请稍后再试。" }), {
                status: 429,
                headers: { "Content-Type": "application/json" },
            }),
        )

        const res = await POST(makeRequest({ messages: [] }))

        expect(res.status).toBe(429)
    })

    it("returns 400 when last user message exceeds 500 chars", async () => {
        sessionMock.mockResolvedValueOnce({ user: { id: "user_1", name: "Test" } })

        const res = await POST(
            makeRequest({
                messages: [{
                    id: "m1",
                    role: "user",
                    parts: [{ type: "text", text: "a".repeat(501) }],
                }],
            }),
        )

        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data).toEqual({ error: "消息过长，请控制在 500 字以内。" })
    })

    it("returns 200 stream when request is valid", async () => {
        sessionMock.mockResolvedValueOnce({ user: { id: "user_1", name: "Test" } })

        const res = await POST(
            makeRequest({
                messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "你好" }] }],
            }),
        )

        expect(res.status).toBe(200)
        expect(streamTextMock).toHaveBeenCalledTimes(1)
    })

    it("truncates context to last 10 messages before calling streamText", async () => {
        sessionMock.mockResolvedValueOnce({ user: { id: "user_1", name: "Test" } })

        await POST(makeRequest({ messages: makeMessages(15) }))

        // convertToModelMessages is mocked to pass through, so streamText receives 10 items
        const callArgs = streamTextMock.mock.calls[0][0]
        expect(callArgs.messages).toHaveLength(10)
    })
})
