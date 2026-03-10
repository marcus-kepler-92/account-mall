import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { updateGuideSchema } from "@/lib/validations/guide"
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
    badRequest,
} from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/guides/[id]
 * Admin only: get single guide for editing
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params

    const guide = await prisma.distributorGuide.findUnique({
        where: { id },
        include: { tag: true },
    })

    if (!guide) {
        return notFound("Guide not found")
    }

    return NextResponse.json(guide)
}

/**
 * PATCH /api/admin/guides/[id]
 * Admin only: update guide
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateGuideSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const existing = await prisma.distributorGuide.findUnique({
        where: { id },
    })
    if (!existing) {
        return notFound("Guide not found")
    }

    const { title, content, tagId, status, sortOrder } = parsed.data

    if (tagId !== undefined && tagId != null && tagId !== "") {
        const tag = await prisma.tag.findUnique({ where: { id: tagId } })
        if (!tag) {
            return badRequest("关联类目不存在")
        }
    }

    const updateData: {
        title?: string
        content?: string | null
        tagId?: string | null
        status?: "DRAFT" | "PUBLISHED"
        sortOrder?: number
        publishedAt?: Date | null
    } = {}

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (tagId !== undefined) updateData.tagId = tagId && tagId !== "" ? tagId : null
    if (status !== undefined) updateData.status = status
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        updateData.publishedAt = new Date()
    } else if (status === "DRAFT") {
        updateData.publishedAt = null
    }

    const guide = await prisma.distributorGuide.update({
        where: { id },
        data: updateData,
        include: { tag: true },
    })

    return NextResponse.json(guide)
}

/**
 * DELETE /api/admin/guides/[id]
 * Admin only: delete guide
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) {
        return unauthorized()
    }

    const { id } = await context.params

    const existing = await prisma.distributorGuide.findUnique({
        where: { id },
    })
    if (!existing) {
        return notFound("Guide not found")
    }

    await prisma.distributorGuide.delete({
        where: { id },
    })

    return NextResponse.json({ message: "Guide deleted" })
}

export const runtime = "nodejs"
