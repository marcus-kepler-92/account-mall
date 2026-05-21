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
        // CRITICAL: only emit text parts.
        //
        // USER  `parts` was persisted from a UIMessage and is already
        //       client-side shape, but assistants store `assistant.content`
        //       from the AI SDK response which uses server-side ModelMessage
        //       shape (`tool-call` / `tool-result` parts whose schema does
        //       NOT match UIMessage parts client-side). Feeding that to
        //       useChatRuntime({ messages }) corrupts the thread.
        //
        // Strategy: strip everything to plain text. We already use
        // `contentText` (server-extracted text) as the authoritative
        // human-readable record for admin views. Tool calls deliberately
        // do NOT replay — sliding-window history is for context only,
        // not for re-executing the side effects.
        const text = m.contentText ?? ""
        const parts: UIMessagePart[] =
            text.length > 0 ? [{ type: "text", text }] : []
        return {
            id: m.id,
            role: m.role.toLowerCase() as "user" | "assistant",
            parts,
        }
    })

    return Response.json({ messages })
}
