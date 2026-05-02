import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * POST /api/distributor/announcements/[id]/ack
 * Distributor only: mark an announcement as read (idempotent).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
    const session = await getDistributorSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params
    const userId = session.user.id

    const announcement = await prisma.announcement.findUnique({
        where: { id },
        select: { id: true, status: true, audience: true },
    })

    if (
        !announcement ||
        announcement.status !== "PUBLISHED" ||
        !["DISTRIBUTOR", "ALL"].includes(announcement.audience)
    ) {
        return notFound("Announcement not found")
    }

    const read = await prisma.announcementRead.upsert({
        where: { userId_announcementId: { userId, announcementId: id } },
        create: { userId, announcementId: id },
        update: {},
        select: { readAt: true },
    })

    return NextResponse.json({ success: true, readAt: read.readAt })
}

export const runtime = "nodejs"
