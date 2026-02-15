import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { createProductSchema } from "@/lib/validations/product";
import { unauthorized, invalidJsonBody, validationError, conflict } from "@/lib/api-response";

/**
 * GET /api/products
 * Public: returns only ACTIVE products with tags and stock count
 * Admin (with ?admin=true): returns all products with full details
 */
const SORT_OPTIONS = ["default", "price-asc", "price-desc", "newest"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

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

    // Order
    const orderBy: { price?: "asc" | "desc"; createdAt?: "desc" } =
        sort === "price-asc"
            ? { price: "asc" }
            : sort === "price-desc"
              ? { price: "desc" }
              : sort === "newest"
                ? { createdAt: "desc" }
                : { createdAt: "desc" };

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

    // Also get unsold card counts for stock display
    const productsWithStock = await Promise.all(
        products.map(async (product) => {
            const unsoldCount = await prisma.card.count({
                where: {
                    productId: product.id,
                    status: "UNSOLD",
                },
            });

            return {
                ...product,
                price: Number(product.price),
                stock: unsoldCount,
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

    const { name, slug, description, image, price, maxQuantity, status, tagIds } =
        parsed.data;

    // Check slug uniqueness
    const existingSlug = await prisma.product.findUnique({
        where: { slug },
    });
    if (existingSlug) {
        return conflict("A product with this slug already exists");
    }

    const product = await prisma.product.create({
        data: {
            name,
            slug,
            description: description ?? null,
            image: image ?? null,
            price,
            maxQuantity: maxQuantity ?? 10,
            status: status ?? "ACTIVE",
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
