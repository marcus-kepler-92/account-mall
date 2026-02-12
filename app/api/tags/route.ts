import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { createTagSchema } from "@/lib/validations/product";
import { generateSlug } from "@/lib/utils";

/**
 * GET /api/tags
 * Public: returns all tags with product counts
 */
export async function GET() {
    const tags = await prisma.tag.findMany({
        include: {
            _count: {
                select: { products: true },
            },
        },
        orderBy: { name: "asc" },
    });

    return NextResponse.json(tags);
}

/**
 * POST /api/tags
 * Admin only: create a new tag
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { name } = parsed.data;
    const slug = generateSlug(name);

    // Check uniqueness
    const existing = await prisma.tag.findFirst({
        where: {
            OR: [{ name }, { slug }],
        },
    });
    if (existing) {
        return NextResponse.json(
            { error: "A tag with this name already exists" },
            { status: 409 }
        );
    }

    const tag = await prisma.tag.create({
        data: { name, slug },
    });

    return NextResponse.json(tag, { status: 201 });
}

export const runtime = "nodejs";
