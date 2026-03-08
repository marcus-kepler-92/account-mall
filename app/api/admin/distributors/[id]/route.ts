import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound } from "@/lib/api-response"
import { z } from "zod"

const updateDistributorSchema = z.object({
    disabled: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateDistributorSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const existing = await prisma.user.findFirst({
        where: { id, role: "DISTRIBUTOR" },
    })
    if (!existing) return notFound("Distributor not found")

    const user = await prisma.user.update({
        where: { id },
        data: {
            disabledAt: parsed.data.disabled === true ? new Date() : parsed.data.disabled === false ? null : undefined,
        },
        select: {
            id: true,
            email: true,
            name: true,
            distributorCode: true,
            disabledAt: true,
        },
    })

    return NextResponse.json(user)
}
