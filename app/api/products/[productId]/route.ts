import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { updateProductSchema } from "@/lib/validations/product";
import { notFound, unauthorized, invalidJsonBody, validationError, conflict } from "@/lib/api-response";

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
        return notFound("Product not found");
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
        return unauthorized();
    }

    const { productId } = await context.params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    // Check product exists
    const existing = await prisma.product.findUnique({
        where: { id: productId },
    });
    if (!existing) {
        return notFound("Product not found");
    }

    const { tagIds, productType, sourceUrl, price, pinned, ...rest } = parsed.data;

    // Check slug uniqueness if updating slug
    if (rest.slug && rest.slug !== existing.slug) {
        const slugExists = await prisma.product.findUnique({
            where: { slug: rest.slug },
        });
        if (slugExists) {
            return conflict("A product with this slug already exists");
        }
    }

    const isFreeShared = productType === "FREE_SHARED";
    const updateData: Record<string, unknown> = {
        ...rest,
        ...(price !== undefined && { price: isFreeShared ? 0 : price }),
        ...(productType !== undefined && { productType }),
        ...(sourceUrl !== undefined && {
            sourceUrl: isFreeShared && sourceUrl?.trim() ? sourceUrl.trim() : (isFreeShared ? null : sourceUrl ?? undefined),
        }),
        ...(tagIds !== undefined && {
            tags: { set: tagIds.map((id) => ({ id })) },
        }),
        ...(pinned === true && { pinnedAt: new Date() }),
        ...(pinned === false && { pinnedAt: null }),
    };
    if (isFreeShared && updateData.price !== 0) {
        updateData.price = 0;
    }

    const product = await prisma.product.update({
        where: { id: productId },
        data: updateData as Parameters<typeof prisma.product.update>[0]["data"],
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
        return unauthorized();
    }

    const { productId } = await context.params;

    const existing = await prisma.product.findUnique({
        where: { id: productId },
    });
    if (!existing) {
        return notFound("Product not found");
    }

    await prisma.product.update({
        where: { id: productId },
        data: { status: "INACTIVE" },
    });

    return NextResponse.json({ message: "Product deactivated" });
}

export const runtime = "nodejs";
