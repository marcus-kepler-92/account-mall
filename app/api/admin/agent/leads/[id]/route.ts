import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { leadPatchSchema } from "@/lib/validations/agent-lead"
import {
    assertTransition,
    InvalidTransitionError,
} from "@/lib/agent-lead-state-machine"
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
    conflict,
} from "@/lib/api-response"

export const runtime = "nodejs"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * PATCH /api/admin/agent/leads/[id]
 * Admin only: update lead status / notes. Setting status to CONTACTED
 * stamps contactedAt + contactedBy from the current session.
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

    const parsed = leadPatchSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const existing = await prisma.agentLead.findUnique({ where: { id } })
    if (!existing) return notFound("Lead not found")

    // Guard the transition before writing. Notes-only PATCHes skip this gate.
    // Self-loops (status === existing.status) are rejected by the state machine
    // so the contactedAt/By stamp below can't re-fire on a repeat CONTACTED.
    if (parsed.data.status) {
        try {
            assertTransition(existing.status, parsed.data.status)
        } catch (err) {
            if (err instanceof InvalidTransitionError) return conflict(err.message)
            throw err
        }
    }

    // Prisma's update() ignores `undefined`, so spreading parsed.data only
    // writes the fields the client actually sent. Stamp contactedAt/By on
    // the transition to CONTACTED.
    const updated = await prisma.agentLead.update({
        where: { id },
        data: {
            ...parsed.data,
            ...(parsed.data.status === "CONTACTED" && {
                contactedAt: new Date(),
                contactedBy: (session.user as { id: string }).id,
            }),
        },
    })

    return NextResponse.json({ data: updated })
}
