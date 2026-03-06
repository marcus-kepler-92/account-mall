import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { createTagSchema } from "@/lib/validations/product";
import { generateSlug } from "@/lib/utils";
import { unauthorized, invalidJsonBody, validationError, conflict } from "@/lib/api-response";

/**
 * GET /api/tags
 * Public: returns all tags with product counts.
 * Optional ?code=xxx filters counts to only ACTIVE products visible with that secret code (same as product list).
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    const productWhere = (code
        ? { status: "ACTIVE" as const, OR: [{ secretCode: null }, { secretCode: code }] }
        : { status: "ACTIVE" as const, secretCode: null }) as unknown as Prisma.ProductWhereInput;

    const tags = await prisma.tag.findMany({
        include: {
            products: {
                where: productWhere,
                select: { id: true },
            },
        },
        orderBy: { name: "asc" },
    });

    return NextResponse.json(
        tags.map(({ products, ...tag }) => ({
            ...tag,
            _count: { products: products.length },
        }))
    );
}

/**
 * POST /api/tags
 * Admin only: create a new tag
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

    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
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
        return conflict("A tag with this name already exists");
    }

    const tag = await prisma.tag.create({
        data: { name, slug },
    });

    return NextResponse.json(tag, { status: 201 });
}

export const runtime = "nodejs";
