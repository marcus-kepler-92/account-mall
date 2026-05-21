/**
 * Test: GET /api/agent/messages?sessionId=xxx
 *
 * Drives chat-history rehydration when the user reopens the FAB. The
 * server-side AgentMessage table is the source of truth; this route
 * shapes those rows into the AI SDK's UIMessage[] format that
 * useChatRuntime({ messages }) accepts as initial state.
 *
 * Why this needs its own test: the earlier sessionStorage-based attempt
 * broke because of a UIMessage / ThreadMessage shape mismatch. This
 * route's contract is "produce UIMessage[]" — assert it concretely so
 * the regression can't recur silently.
 */
jest.mock("@/lib/prisma", () => ({
    prisma: {
        agentSession: { findUnique: jest.fn() },
        agentMessage: { findMany: jest.fn() },
    },
}))

import { GET } from "@/app/api/agent/messages/route"
import { prisma } from "@/lib/prisma"

const findSession = prisma.agentSession.findUnique as jest.Mock
const findMessages = prisma.agentMessage.findMany as jest.Mock

const VALID_SESSION_ID = "01HXXXXXXXXXXXXXXXXXXXXXXX"

function buildRequest(sessionId?: string | null): Request {
    const url = new URL("http://localhost/api/agent/messages")
    if (sessionId !== null && sessionId !== undefined) {
        url.searchParams.set("sessionId", sessionId)
    }
    return new Request(url.toString())
}

beforeEach(() => {
    jest.clearAllMocks()
    findSession.mockResolvedValue({
        id: VALID_SESSION_ID,
        expiresAt: new Date(Date.now() + 86_400_000),
    })
    findMessages.mockResolvedValue([])
})

describe("GET /api/agent/messages — input validation", () => {
    it("returns empty + 400 when sessionId missing", async () => {
        const res = await GET(buildRequest())
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.messages).toEqual([])
        expect(prisma.agentMessage.findMany).not.toHaveBeenCalled()
    })

    it("returns empty + 400 when sessionId too short", async () => {
        const res = await GET(buildRequest("short"))
        expect(res.status).toBe(400)
        expect(prisma.agentMessage.findMany).not.toHaveBeenCalled()
    })
})

describe("GET /api/agent/messages — session lifecycle", () => {
    it("returns empty (not error) when session doesn't exist", async () => {
        findSession.mockResolvedValueOnce(null)
        const res = await GET(buildRequest(VALID_SESSION_ID))
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.messages).toEqual([])
        expect(prisma.agentMessage.findMany).not.toHaveBeenCalled()
    })

    it("returns empty when session has expired (no point replaying)", async () => {
        findSession.mockResolvedValueOnce({
            id: VALID_SESSION_ID,
            expiresAt: new Date(Date.now() - 1_000),
        })
        const res = await GET(buildRequest(VALID_SESSION_ID))
        const body = await res.json()
        expect(body.messages).toEqual([])
        expect(prisma.agentMessage.findMany).not.toHaveBeenCalled()
    })
})

describe("GET /api/agent/messages — UIMessage shape", () => {
    it("returns messages with lowercased role + parts in chronological order", async () => {
        findMessages.mockResolvedValueOnce([
            {
                id: "m1",
                role: "USER",
                parts: [{ type: "text", text: "Hi" }],
                contentText: "Hi",
            },
            {
                id: "m2",
                role: "ASSISTANT",
                parts: [{ type: "text", text: "Hello!" }],
                contentText: "Hello!",
            },
        ])
        const res = await GET(buildRequest(VALID_SESSION_ID))
        const body = await res.json()
        expect(body.messages).toEqual([
            { id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] },
            { id: "m2", role: "assistant", parts: [{ type: "text", text: "Hello!" }] },
        ])
    })

    it("excludes TOOL-role rows (they don't render in the UI anyway)", async () => {
        await GET(buildRequest(VALID_SESSION_ID))
        const where = findMessages.mock.calls[0][0].where
        expect(where.role).toEqual({ in: ["USER", "ASSISTANT"] })
    })

    it("orders messages ascending by createdAt", async () => {
        await GET(buildRequest(VALID_SESSION_ID))
        const args = findMessages.mock.calls[0][0]
        expect(args.orderBy).toEqual({ createdAt: "asc" })
    })

    it("falls back to a single text part when parts is not an array (defensive)", async () => {
        findMessages.mockResolvedValueOnce([
            { id: "m1", role: "USER", parts: null, contentText: "raw text" },
        ])
        const body = await (await GET(buildRequest(VALID_SESSION_ID))).json()
        expect(body.messages[0]).toEqual({
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "raw text" }],
        })
    })

    it("returns empty parts array when both parts and contentText are absent", async () => {
        findMessages.mockResolvedValueOnce([
            { id: "m1", role: "ASSISTANT", parts: null, contentText: "" },
        ])
        const body = await (await GET(buildRequest(VALID_SESSION_ID))).json()
        expect(body.messages[0].parts).toEqual([])
    })

    it("strips non-text parts from ASSISTANT history (tool-call / tool-result don't replay)", async () => {
        // Regression guard for "useChatRuntime({ messages }) corrupted by
        // server-side ModelMessage shape". AgentMessage.parts for assistants
        // is the AI SDK response `content` which includes tool-call /
        // tool-result parts whose schema does NOT match UIMessage parts on
        // the client. We rebuild the parts array from `contentText` so the
        // hydrated thread is always pure text.
        findMessages.mockResolvedValueOnce([
            {
                id: "m-tool",
                role: "ASSISTANT",
                // Raw parts as the AI SDK would persist them — must NOT
                // appear in the response.
                parts: [
                    { type: "text", text: "Let me check that order for you." },
                    {
                        type: "tool-call",
                        toolCallId: "call_abc",
                        toolName: "lookupOrder",
                        args: { orderNo: "OD123" },
                    },
                ],
                contentText: "Let me check that order for you.",
            },
        ])
        const body = await (await GET(buildRequest(VALID_SESSION_ID))).json()
        expect(body.messages[0].parts).toEqual([
            { type: "text", text: "Let me check that order for you." },
        ])
        // Defense-in-depth: nothing tool-shaped leaks out
        const serialized = JSON.stringify(body)
        expect(serialized).not.toMatch(/tool-call|toolCallId|toolName/i)
    })

    it("ignores raw parts entirely — contentText is the only source of truth", async () => {
        // Even when parts is present and contentText is empty, the response
        // must NOT fall back to parts (that would resurrect the bug).
        findMessages.mockResolvedValueOnce([
            {
                id: "m-raw-only",
                role: "ASSISTANT",
                parts: [{ type: "text", text: "this should NOT appear" }],
                contentText: "",
            },
        ])
        const body = await (await GET(buildRequest(VALID_SESSION_ID))).json()
        expect(body.messages[0].parts).toEqual([])
        expect(JSON.stringify(body)).not.toContain("this should NOT appear")
    })

    it("does not leak email / card / token fields", async () => {
        findMessages.mockResolvedValueOnce([
            { id: "m1", role: "USER", parts: [{ type: "text", text: "hi" }], contentText: "hi" },
        ])
        const body = await (await GET(buildRequest(VALID_SESSION_ID))).json()
        const serialized = JSON.stringify(body)
        expect(serialized).not.toMatch(/email|cardCode|password|token/i)
    })
})
