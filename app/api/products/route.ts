import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { createProductSchema } from "@/lib/validations/product";
import { config } from "@/lib/config";
import { unauthorized, invalidJsonBody, validationError, conflict } from "@/lib/api-response";

/**
 * GET /api/products
 * Public: returns only ACTIVE products with tags and stock count
 * Admin (with ?admin=true): returns all products with full details
 */
type SortOption = "default" | "price-asc" | "price-desc" | "newest";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const isAdmin = searchParams.get("admin") === "true";
    const status = searchParams.get("status"); // ACTIVE | INACTIVE | null (all)
    const tagParam = searchParams.get("tag");
    const tagSlugs = tagParam ? tagParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const search = searchParams.get("q") ?? searchParams.get("search") ?? "";
    const sort = (searchParams.get("sort") ?? "default") as SortOption;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "9", 10)));

    // If requesting admin view, verify authentication
    if (isAdmin) {
        const session = await getAdminSession();
        if (!session) {
            return unauthorized();
        }
    }

    // Build where clause
    const where: Record<string, unknown> = {};

    if (isAdmin) {
        // Admin can filter by status
        if (status === "ACTIVE" || status === "INACTIVE") {
            where.status = status;
        }
    } else {
        // Public: only active products
        where.status = "ACTIVE";

        // Secret code filter: show products with no secretCode, or matching secretCode
        const code = searchParams.get("code");
        if (code) {
            where.OR = [
                { secretCode: null },
                { secretCode: code },
            ];
        } else {
            where.secretCode = null;
        }
    }

    // Filter by tag(s)
    if (tagSlugs.length > 0) {
        where.tags = {
            some: { slug: { in: tagSlugs } },
        };
    }

    // Search by name
    if (search.trim()) {
        where.name = {
            contains: search.trim(),
            mode: "insensitive",
        };
    }

    // Order: pinned first, then by sort option
    const sortOrder =
        sort === "price-asc"
            ? { price: "asc" as const }
            : sort === "price-desc"
              ? { price: "desc" as const }
              : { createdAt: "desc" as const };
    const orderBy = [
        { pinnedAt: { sort: "desc" as const, nulls: "last" as const } },
        sortOrder,
    ];

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                tags: {
                    select: { id: true, name: true, slug: true },
                },
                _count: {
                    select: { cards: true },
                },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.product.count({ where }),
    ]);

    // Also get unsold card counts for stock display (FREE_SHARED 无预存卡密，stock 仅用于展示，前端按 productType 判断可领取)
    const productsWithStock = await Promise.all(
        products.map(async (product) => {
            const unsoldCount = await prisma.card.count({
                where: {
                    productId: product.id,
                    status: "UNSOLD",
                },
            });
            const isFreeShared = product.productType === "FREE_SHARED";
            return {
                ...product,
                price: Number(product.price),
                stock: unsoldCount,
                productType: product.productType ?? "NORMAL",
                sourceUrl: product.sourceUrl ?? null,
                // 免费共享在列表里按「有货」展示，不依赖库存数
                ...(isFreeShared && { stock: 1 }),
            };
        })
    );

    return NextResponse.json({
        data: productsWithStock,
        meta: {
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        },
    });
}

/**
 * POST /api/products
 * Admin only: create a new product
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
        return invalidJsonBody();
    }

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const { name, slug, description, summary, image, price, maxQuantity, status, tagIds, productType, sourceUrl, secretCode } =
        parsed.data;

    // Check slug uniqueness
    const existingSlug = await prisma.product.findUnique({
        where: { slug },
    });
    if (existingSlug) {
        return conflict("A product with this slug already exists");
    }

    const isFreeShared = productType === "FREE_SHARED";
    const finalPrice = isFreeShared ? 0 : price;
    const finalMaxQuantity = isFreeShared ? config.freeSharedMaxQuantityPerOrder : (maxQuantity ?? 10);
    const finalSourceUrl = isFreeShared ? null : (sourceUrl?.trim() || null);

    const product = await prisma.product.create({
        data: {
            name,
            slug,
            description: description ?? null,
            summary: summary ?? null,
            image: image ?? null,
            price: finalPrice,
            maxQuantity: finalMaxQuantity,
            status: status ?? "ACTIVE",
            productType: productType ?? "NORMAL",
            sourceUrl: finalSourceUrl,
            secretCode: secretCode?.trim() || null,
            tags:
                tagIds && tagIds.length > 0
                    ? { connect: tagIds.map((id) => ({ id })) }
                    : undefined,
        },
        include: {
            tags: {
                select: { id: true, name: true, slug: true },
            },
        },
    });

    return NextResponse.json(
        { ...product, price: Number(product.price) },
        { status: 201 }
    );
}

export const runtime = "nodejs";
