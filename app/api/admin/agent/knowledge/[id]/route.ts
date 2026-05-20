import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { knowledgePatchSchema } from "@/lib/validations/agent-knowledge"
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response"

export const runtime = "nodejs"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/agent/knowledge/[id]
 * Admin only: fetch single knowledge entry for editing.
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await ctx.params

    const row = await prisma.agentKnowledge.findUnique({
        where: { id },
    })
    if (!row) return notFound("Knowledge not found")

    return NextResponse.json({ data: row })
}

/**
 * PATCH /api/admin/agent/knowledge/[id]
 * Admin only: update knowledge entry. Auto-sets publishedAt when transitioning to PUBLISHED.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await ctx.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = knowledgePatchSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const existing = await prisma.agentKnowledge.findUnique({ where: { id } })
    if (!existing) return notFound("Knowledge not found")

    // Prisma's update() ignores `undefined`, so spreading parsed.data only
    // writes the fields the client actually sent. Stamp publishedAt on the
    // DRAFT/ARCHIVED → PUBLISHED transition.
    const updated = await prisma.agentKnowledge.update({
        where: { id },
        data: {
            ...parsed.data,
            ...(parsed.data.status === "PUBLISHED" && { publishedAt: new Date() }),
        },
    })

    revalidateTag("agent-knowledge", "max")

    return NextResponse.json({ data: updated })
}

/**
 * DELETE /api/admin/agent/knowledge/[id]
 * Admin only: delete a knowledge entry.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await ctx.params

    const existing = await prisma.agentKnowledge.findUnique({ where: { id } })
    if (!existing) return notFound("Knowledge not found")

    await prisma.agentKnowledge.delete({ where: { id } })

    revalidateTag("agent-knowledge", "max")

    return new NextResponse(null, { status: 204 })
}
