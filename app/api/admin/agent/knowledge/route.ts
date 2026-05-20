import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { knowledgeSchema } from "@/lib/validations/agent-knowledge"
import {
    unauthorized,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response"

export const runtime = "nodejs"

/**
 * GET /api/admin/agent/knowledge
 * Admin only: list all knowledge entries (any status), ordered by updatedAt desc.
 */
export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const rows = await prisma.agentKnowledge.findMany({
        orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ data: rows })
}

/**
 * POST /api/admin/agent/knowledge
 * Admin only: create a knowledge entry.
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = knowledgeSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const authorId = (session.user as { id: string }).id

    const created = await prisma.agentKnowledge.create({
        data: {
            ...parsed.data,
            authorId,
        },
    })

    revalidateTag("agent-knowledge", "max")

    return NextResponse.json({ data: created }, { status: 201 })
}
