import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { unauthorized, validationError, invalidJsonBody } from "@/lib/api-response"
import { SOURCE_KEYS } from "@/lib/admin-notifications"

const dismissAllBody = z.object({
    items: z
        .array(
            z.object({
                sourceKey: z.enum(SOURCE_KEYS),
                itemId: z.string().min(1).max(64),
                fingerprint: z.string().min(1).max(128),
            }),
        )
        .min(1)
        .max(500),
})

export async function POST(request: Request): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let raw: unknown
    try {
        raw = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = dismissAllBody.safeParse(raw)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const adminId = session.user.id
    const now = new Date()

    // Transaction keeps the dismissal set consistent if any row fails.
    await prisma.$transaction(
        parsed.data.items.map((it) =>
            prisma.adminNotificationDismissal.upsert({
                where: {
                    adminId_sourceKey_itemId: { adminId, sourceKey: it.sourceKey, itemId: it.itemId },
                },
                update: { fingerprint: it.fingerprint, dismissedAt: now },
                create: { adminId, sourceKey: it.sourceKey, itemId: it.itemId, fingerprint: it.fingerprint },
            }),
        ),
    )

    return NextResponse.json({ ok: true, dismissed: parsed.data.items.length })
}

export const runtime = "nodejs"
