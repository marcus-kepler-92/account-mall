import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, validationError, invalidJsonBody } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { SOURCE_KEYS } from "@/lib/admin-notifications"

const bodySchema = z.object({
    items: z
        .array(
            z.object({
                sourceKey: z.enum(SOURCE_KEYS),
                itemId: z.string().min(1).max(64),
            }),
        )
        .min(1)
        .max(50),
})

/**
 * Restore previously dismissed notifications by deleting the dismissal
 * rows. After restore the items will reappear in the unread list on the
 * next /api/admin/notifications fetch — provided the underlying entity
 * still exists and the fingerprint hasn't changed.
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
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const adminId = session.user.id
    const { items } = parsed.data

    const result = await prisma.adminNotificationDismissal.deleteMany({
        where: {
            adminId,
            OR: items.map((it) => ({
                sourceKey: it.sourceKey,
                itemId: it.itemId,
            })),
        },
    })

    return NextResponse.json({ ok: true, restored: result.count })
}

export const runtime = "nodejs"
