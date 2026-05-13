import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard";
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

    const orderBy =
        sort === "price-asc"
            ? [{ price: "asc" as const }]
            : sort === "price-desc"
              ? [{ price: "desc" as const }]
              : sort === "newest"
                ? [{ createdAt: "desc" as const }]
                : [{ sortOrder: "asc" as const }]

    const [products, total, stockCounts] = await Promise.all([
        prisma.product.findMany({
            where,
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                summary: true,
                image: true,
                price: true,
                productType: true,
                status: true,
                sortOrder: true,
                sourceUrl: true,
                tags: { select: { id: true, name: true, slug: true } },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.product.count({ where }),
        prisma.card.groupBy({
            by: ["productId"],
            where: { status: "UNSOLD" },
            _count: { id: true },
        }),
    ]);

    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]));

    const productsWithStock = products.map((product) => {
        const { sourceUrl, ...productRest } = product;
        const isAutoFetch = product.productType === "AUTO_FETCH";
        return {
            ...productRest,
            price: Number(product.price),
            productType: product.productType ?? "NORMAL",
            // AUTO_FETCH 在列表里按「有货」展示，不依赖库存数
            stock: isAutoFetch ? 1 : (stockMap.get(product.id) ?? 0),
            ...(isAdmin && { sourceUrl: sourceUrl ?? null }),
        };
    });

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
    const session = await getSuperAdminSession();
    if (!session) {
        return unauthorized();
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

    const { name, slug, description, summary, image, price, maxQuantity, status, tagIds, productType, sourceUrl, validityHours, allowAccountSwitch, accountSwitchLimit, couponEnabled, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity, excludeFromAttribution } =
        parsed.data;

    // Check slug uniqueness
    const existingSlug = await prisma.product.findUnique({
        where: { slug },
    });
    if (existingSlug) {
        return conflict("A product with this slug already exists");
    }

    const isAutoFetch = productType === "AUTO_FETCH";
    const finalPrice = isAutoFetch ? (price ?? 0) : price;
    const finalMaxQuantity = isAutoFetch ? config.autoFetchMaxQuantityPerOrder : (maxQuantity ?? 10);
    const finalSourceUrl = sourceUrl?.trim() || null;

    const maxSortOrder = await prisma.product.aggregate({
        _max: { sortOrder: true },
    })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    const product = await prisma.product.create({
        data: {
            sortOrder: nextSortOrder,
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
            ...(validityHours != null && { validityHours }),
            ...(allowAccountSwitch != null && { allowAccountSwitch }),
            ...(accountSwitchLimit != null && { accountSwitchLimit }),
            riskWarningEnabled: riskWarningEnabled ?? false,
            riskWarningTitle: riskWarningTitle ?? null,
            riskWarningContent: riskWarningContent ?? null,
            riskWarningCountdown: riskWarningCountdown ?? null,
            riskWarningConfirmText: riskWarningConfirmText ?? null,
            couponEnabled: couponEnabled ?? false,
            purchaseLimitEnabled: purchaseLimitEnabled ?? false,
            purchaseLimitQuantity: purchaseLimitQuantity ?? 1,
            excludeFromAttribution: excludeFromAttribution ?? false,
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
