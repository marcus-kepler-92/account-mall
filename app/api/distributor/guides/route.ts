import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

/**
 * GET /api/distributor/guides
 * Distributor only: list PUBLISHED guides with tag, optional ?tagId= filter
 */
export async function GET(request: NextRequest) {
    const session = await getDistributorSession()
    if (!session) {
        return unauthorized()
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get("tagId") ?? undefined

    const where: { status: "PUBLISHED"; tagId?: string | null } = {
        status: "PUBLISHED",
    }
    if (tagId != null && tagId !== "") {
        where.tagId = tagId
    }

    const guides = await prisma.distributorGuide.findMany({
        where,
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        include: { tag: true },
    })

    return NextResponse.json({ data: guides })
}

export const runtime = "nodejs"
