import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { updateProductSchema } from "@/lib/validations/product";

type RouteContext = {
    params: Promise<{ productId: string }>;
};

/**
 * GET /api/products/[productId]
 * Public: get product detail
 */
export async function GET(
    _request: NextRequest,
    context: RouteContext
) {
    const { productId } = await context.params;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
            tags: {
                select: { id: true, name: true, slug: true },
            },
        },
    });

    if (!product) {
        return NextResponse.json(
            { error: "Product not found" },
            { status: 404 }
        );
    }

    // Get stock count
    const unsoldCount = await prisma.card.count({
        where: {
            productId: product.id,
            status: "UNSOLD",
        },
    });

    return NextResponse.json({
        ...product,
        price: Number(product.price),
        stock: unsoldCount,
    });
}

/**
 * PUT /api/products/[productId]
 * Admin only: update product
 */
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { productId } = await context.params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    // Check product exists
    const existing = await prisma.product.findUnique({
        where: { id: productId },
    });
    if (!existing) {
        return NextResponse.json(
            { error: "Product not found" },
            { status: 404 }
        );
    }

    const { tagIds, ...data } = parsed.data;

    // Check slug uniqueness if updating slug
    if (data.slug && data.slug !== existing.slug) {
        const slugExists = await prisma.product.findUnique({
            where: { slug: data.slug },
        });
        if (slugExists) {
            return NextResponse.json(
                { error: "A product with this slug already exists" },
                { status: 409 }
            );
        }
    }

    const product = await prisma.product.update({
        where: { id: productId },
        data: {
            ...data,
            // If tagIds is provided, replace all tags
            ...(tagIds !== undefined && {
                tags: {
                    set: tagIds.map((id) => ({ id })),
                },
            }),
        },
        include: {
            tags: {
                select: { id: true, name: true, slug: true },
            },
        },
    });

    return NextResponse.json({
        ...product,
        price: Number(product.price),
    });
}

/**
 * DELETE /api/products/[productId]
 * Admin only: soft-delete product (set INACTIVE)
 */
export async function DELETE(
    _request: NextRequest,
    context: RouteContext
) {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const { productId } = await context.params;

    const existing = await prisma.product.findUnique({
        where: { id: productId },
    });
    if (!existing) {
        return NextResponse.json(
            { error: "Product not found" },
            { status: 404 }
        );
    }

    await prisma.product.update({
        where: { id: productId },
        data: { status: "INACTIVE" },
    });

    return NextResponse.json({ message: "Product deactivated" });
}

export const runtime = "nodejs";
