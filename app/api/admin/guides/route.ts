import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { createGuideSchema } from "@/lib/validations/guide"
import {
    unauthorized,
    invalidJsonBody,
    validationError,
    badRequest,
} from "@/lib/api-response"

/**
 * GET /api/admin/guides
 * Admin only: list all guides with tag
 */
export async function GET() {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const guides = await prisma.distributorGuide.findMany({
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        include: { tag: true },
    })

    return NextResponse.json(guides)
}

/**
 * POST /api/admin/guides
 * Admin only: create a new guide
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createGuideSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { title, content, tagId, status, sortOrder } = parsed.data

    if (tagId != null && tagId !== "") {
        const tag = await prisma.tag.findUnique({ where: { id: tagId } })
        if (!tag) {
            return badRequest("关联类目不存在")
        }
    }

    const isPublished = status === "PUBLISHED"
    const guide = await prisma.distributorGuide.create({
        data: {
            title,
            content: content ?? null,
            tagId: tagId && tagId !== "" ? tagId : null,
            status: status ?? "DRAFT",
            sortOrder: sortOrder ?? 0,
            publishedAt: isPublished ? new Date() : null,
        },
        include: { tag: true },
    })

    return NextResponse.json(guide, { status: 201 })
}

export const runtime = "nodejs"
