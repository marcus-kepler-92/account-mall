import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { updateProductSchema } from "@/lib/validations/product";
import { config } from "@/lib/config";
import { notFound, unauthorized, invalidJsonBody, validationError, conflict, badRequest } from "@/lib/api-response";

type RouteContext = {
    params: Promise<{ productId: string }>;
};

/**
 * GET /api/products/[productId]
 * Public: get product detail
 */
export async function GET(
    request: NextRequest,
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
            sourceUrl: isFreeShared ? null : (sourceUrl?.trim() || undefined),
        }),
        ...(tagIds !== undefined && {
            tags: { set: tagIds.map((id) => ({ id })) },
        }),
        ...(pinned === true && { pinnedAt: new Date() }),
        ...(pinned === false && { pinnedAt: null }),
    };
    if (isFreeShared) {
        updateData.price = 0;
        updateData.maxQuantity = config.freeSharedMaxQuantityPerOrder;
        updateData.sourceUrl = null;
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
 * Admin only.
 * - No query: soft-delete (set INACTIVE).
 * - ?permanent=true: hard-delete (only if INACTIVE and no orders).
 */
export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { productId } = await context.params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    const existing = await prisma.product.findUnique({
        where: { id: productId },
    });
    if (!existing) {
        return notFound("Product not found");
    }

    if (permanent) {
        if (existing.status !== "INACTIVE") {
            return badRequest("只能删除已下架的商品");
        }
        const orderCount = await prisma.order.count({
            where: { productId },
        });
        if (orderCount > 0) {
            return badRequest("该商品存在关联订单，无法删除");
        }

        await prisma.$transaction(async (tx) => {
            await tx.card.deleteMany({ where: { productId } });
            await tx.restockSubscription.deleteMany({ where: { productId } });
            await tx.product.update({
                where: { id: productId },
                data: { tags: { set: [] } },
            });
            await tx.product.delete({ where: { id: productId } });
        });

        return NextResponse.json({ message: "Product deleted" });
    }

    await prisma.product.update({
        where: { id: productId },
        data: { status: "INACTIVE" },
    });

    return NextResponse.json({ message: "Product deactivated" });
}

export const runtime = "nodejs";
