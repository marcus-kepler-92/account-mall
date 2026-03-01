import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { createAnnouncementSchema } from "@/lib/validations/announcement";
import {
    unauthorized,
    invalidJsonBody,
    validationError,
} from "@/lib/api-response";

const PUBLIC_LIMIT = 20;

/**
 * GET /api/announcements
 * Public: returns only PUBLISHED announcements, ordered by sortOrder desc, publishedAt desc
 * Admin (with ?admin=true): returns all announcements
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "true";
    const limit = Math.min(
        50,
        Math.max(1, parseInt(searchParams.get("limit") ?? String(PUBLIC_LIMIT), 10))
    );

    if (isAdmin) {
        const session = await getAdminSession();
        if (!session) {
            return unauthorized();
        }
    }

    const where = isAdmin ? {} : { status: "PUBLISHED" as const };

    const announcements = await prisma.announcement.findMany({
        where,
        orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
    });

    return NextResponse.json(
        isAdmin ? announcements : { data: announcements }
    );
}

/**
 * POST /api/announcements
 * Admin only: create a new announcement
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const { title, content, status, sortOrder } = parsed.data;
    const isPublished = status === "PUBLISHED";

    const announcement = await prisma.announcement.create({
        data: {
            title,
            content: content ?? null,
            status: status ?? "DRAFT",
            sortOrder: sortOrder ?? 0,
            publishedAt: isPublished ? new Date() : null,
        },
    });

    return NextResponse.json(announcement, { status: 201 });
}

export const runtime = "nodejs";
