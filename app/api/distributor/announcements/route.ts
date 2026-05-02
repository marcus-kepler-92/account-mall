import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

/**
 * GET /api/distributor/announcements
 * Distributor only: list PUBLISHED announcements visible to distributors (audience DISTRIBUTOR or ALL).
 * Supports ?unread=true&mandatory=true for fetching only unread mandatory announcements (modal use).
 * Response includes hasRead flag per announcement.
 */
export async function GET(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) {
        return unauthorized()
    }

    const userId = session.user.id
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const mandatoryOnly = searchParams.get("mandatory") === "true"

    const where: {
        status: "PUBLISHED"
        audience: { in: ("DISTRIBUTOR" | "ALL")[] }
        isMandatory?: boolean
        reads?: { none: { userId: string } }
    } = {
        status: "PUBLISHED",
        audience: { in: ["DISTRIBUTOR", "ALL"] },
    }

    if (mandatoryOnly) {
        where.isMandatory = true
    }

    if (unreadOnly) {
        where.reads = { none: { userId } }
    }

    const announcements = await prisma.announcement.findMany({
        where,
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        include: {
            reads: {
                where: { userId },
                select: { readAt: true },
            },
        },
        take: 50,
    })

    const data = announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        publishedAt: a.publishedAt,
        isMandatory: a.isMandatory,
        hasRead: a.reads.length > 0,
        readAt: a.reads[0]?.readAt ?? null,
    }))

    return NextResponse.json({ data })
}

export const runtime = "nodejs"
