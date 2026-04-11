import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError } from "@/lib/api-response"

const reorderSchema = z.object({
    ids: z.array(z.string()).min(1),
})

export async function PATCH(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = reorderSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { ids } = parsed.data

    await prisma.$transaction(
        ids.map((id, index) =>
            prisma.product.update({
                where: { id },
                data: { sortOrder: index },
            })
        )
    )

    return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
