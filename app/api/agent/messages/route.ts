import { z } from "zod"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

// GET /api/agent/messages?sessionId=xxx
//
// Returns the persisted USER + ASSISTANT messages for a session in the
// shape the AI SDK's useChatRuntime expects (UIMessage[]). Used by the
// chat widget to rehydrate chat history when the user reopens the FAB
// after Radix unmounts the popover children.
//
// TOOL-role messages are intentionally excluded: the UI doesn't render
// internal tool calls (we hide them behind the generic "正在为您查询资料…"
// badge), and the AI SDK rebuilds tool context on the server for any new
// turn anyway. Round-tripping them here would risk replaying stale
// tool-call IDs.
//
// Session ownership is loose by design: anyone with the session id (a
// 26-char ULID generated client-side and stored in localStorage) can
// fetch its messages. No card content / email is ever in AgentMessage,
// so the worst leak is "what was said in chat" — same risk surface as
// the orderHints flow.
const schema = z.object({ sessionId: z.string().min(20).max(40) })

type UIMessagePart = { type: string; text?: string }

export async function GET(req: Request) {
    const url = new URL(req.url)
    const parsed = schema.safeParse({ sessionId: url.searchParams.get("sessionId") })
    if (!parsed.success) {
        return Response.json({ messages: [] }, { status: 400 })
    }
    const { sessionId } = parsed.data

    // Verify the session row exists and is not expired. Expired sessions
    // return empty so we don't replay history for a session the user can
    // no longer send to (would just confuse them when sending fails).
    const session = await prisma.agentSession.findUnique({
        where: { id: sessionId },
        select: { id: true, expiresAt: true },
    })
    if (!session || session.expiresAt < new Date()) {
        return Response.json({ messages: [] })
    }

    const rows = await prisma.agentMessage.findMany({
        where: { sessionId, role: { in: ["USER", "ASSISTANT"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, parts: true, contentText: true },
    })

    const messages = rows.map((m) => {
        // `parts` was persisted as `message.parts as never` (USER) or
        // `assistant.content as never` (ASSISTANT). Both should already
        // be UIMessage-part shapes; we defensively coerce to an array
        // and fall back to a single text part if the shape drifted.
        let parts: UIMessagePart[]
        if (Array.isArray(m.parts)) {
            parts = m.parts as UIMessagePart[]
        } else if (m.contentText) {
            parts = [{ type: "text", text: m.contentText }]
        } else {
            parts = []
        }
        return {
            id: m.id,
            role: m.role.toLowerCase() as "user" | "assistant",
            parts,
        }
    })

    return Response.json({ messages })
}
