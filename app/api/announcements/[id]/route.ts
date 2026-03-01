import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { updateAnnouncementSchema } from "@/lib/validations/announcement";
import {
    unauthorized,
    notFound,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response";

type RouteContext = {
    params: Promise<{ id: string }>;
};

/**
 * GET /api/announcements/[id]
 * Admin only: get single announcement for editing
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { id } = await context.params;

    const announcement = await prisma.announcement.findUnique({
        where: { id },
    });

    if (!announcement) {
        return notFound("Announcement not found");
    }

    return NextResponse.json(announcement);
}

/**
 * PATCH /api/announcements/[id]
 * Admin only: update announcement
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { id } = await context.params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = updateAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const existing = await prisma.announcement.findUnique({
        where: { id },
    });
    if (!existing) {
        return notFound("Announcement not found");
    }

    const { title, content, status, sortOrder } = parsed.data;

    const updateData: {
        title?: string;
        content?: string | null;
        status?: "DRAFT" | "PUBLISHED";
        sortOrder?: number;
        publishedAt?: Date | null;
    } = {};

    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) updateData.status = status;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
        updateData.publishedAt = new Date();
    } else if (status === "DRAFT") {
        updateData.publishedAt = null;
    }

    const announcement = await prisma.announcement.update({
        where: { id },
        data: updateData,
    });

    return NextResponse.json(announcement);
}

/**
 * DELETE /api/announcements/[id]
 * Admin only: delete announcement
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { id } = await context.params;

    const existing = await prisma.announcement.findUnique({
        where: { id },
    });
    if (!existing) {
        return notFound("Announcement not found");
    }

    await prisma.announcement.delete({
        where: { id },
    });

    return NextResponse.json({ message: "Announcement deleted" });
}

export const runtime = "nodejs";
