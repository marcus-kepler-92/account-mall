import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard";
import { createProductSchema } from "@/lib/validations/product";
import { config } from "@/lib/config";
import { unauthorized, invalidJsonBody, validationError, conflict } from "@/lib/api-response";
import { revalidateProducts } from "@/lib/revalidate-storefront";
import { resolveCrossSellDiscounts } from "@/lib/cross-sell";

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

    // Search by product name OR active variant SKU name.
    // For MANUAL products the SKU label (e.g. "一个月 Pro") is what buyers
    // recall, not always the product name — match either to cover both cases.
    // Non-MANUAL products have no variants, so the OR branch is a no-op for them.
    if (search.trim()) {
        const q = search.trim();
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { variants: { some: { name: { contains: q, mode: "insensitive" }, isActive: true } } },
        ];
    }

    const orderBy =
        sort === "price-asc"
            ? [{ price: "asc" as const }]
            : sort === "price-desc"
              ? [{ price: "desc" as const }]
              : sort === "newest"
                ? [{ createdAt: "desc" as const }]
                : [{ sortOrder: "asc" as const }]

    const [products, total] = await Promise.all([
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
                inventoryTracked: true,
                status: true,
                sortOrder: true,
                sourceUrl: true,
                // Admin-only: prefill source for the bulk card import dialog's unitCost field.
                ...(isAdmin && { costPerUnit: true }),
                tags: { select: { id: true, name: true, slug: true } },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.product.count({ where }),
    ]);

    const productIds = products.map(p => p.id)
    const stockCounts = productIds.length > 0
        ? await prisma.card.groupBy({
              by: ["productId"],
              where: { status: "UNSOLD", productId: { in: productIds } },
              _count: { id: true },
          })
        : []

    const stockMap = new Map(stockCounts.map((s) => [s.productId, s._count.id]));

    // MANUAL products do not use the cards table — stock lives on
    // ProductVariant.stockQuantity. Aggregate active variants' stock per
    // product so the storefront cards display the correct "in stock" state
    // (otherwise MANUAL products would render permanently sold-out).
    // We only aggregate for MANUAL products with inventoryTracked=true;
    // untracked MANUAL is unbounded and reported as in-stock unconditionally
    // (sold-out display is driven exclusively by variant.isActive elsewhere).
    const trackedManualProductIds = products
        .filter((p) => p.productType === "MANUAL" && p.inventoryTracked === true)
        .map((p) => p.id);
    const variantStockCounts = trackedManualProductIds.length > 0
        ? await prisma.productVariant.groupBy({
              by: ["productId"],
              where: { productId: { in: trackedManualProductIds }, isActive: true },
              _sum: { stockQuantity: true },
          })
        : [];
    const variantStockMap = new Map(
        variantStockCounts.map((s) => [s.productId, s._sum.stockQuantity ?? 0])
    );

    // MANUAL products carry pricing on variants, not on Product.price (which
    // stays at 0). Aggregate min/max active variant price per MANUAL product
    // so cards can render "¥{min}" or "¥{min} 起" instead of ¥0.00. This runs
    // for ALL MANUAL products regardless of inventoryTracked — pricing display
    // is independent of stock tracking.
    const manualProductIds = products
        .filter((p) => p.productType === "MANUAL")
        .map((p) => p.id);
    const variantPrices = manualProductIds.length > 0
        ? await prisma.productVariant.findMany({
              where: { productId: { in: manualProductIds }, isActive: true },
              select: { productId: true, price: true },
          })
        : [];
    const variantPriceMap = new Map<string, { min: number; max: number }>();
    for (const v of variantPrices) {
        const p = Number(v.price);
        const cur = variantPriceMap.get(v.productId);
        if (!cur) {
            variantPriceMap.set(v.productId, { min: p, max: p });
        } else {
            cur.min = Math.min(cur.min, p);
            cur.max = Math.max(cur.max, p);
        }
    }

    // Cross-sell session: when the storefront passes ?cs=<token>, mark each
    // eligible product with its applicable discountPercent so cards render
    // the discounted price. Admin requests skip this — admin views show raw
    // catalog data, not customer-personalized pricing.
    const csToken = isAdmin ? null : searchParams.get("cs");
    const discountMap = csToken
        ? await resolveCrossSellDiscounts(csToken, productIds)
        : new Map<string, number>();

    const productsWithStock = products.map((product) => {
        const { sourceUrl, costPerUnit, ...productRest } = product as typeof product & {
            costPerUnit?: unknown
        };
        const isAutoFetch = product.productType === "AUTO_FETCH";
        const isManual = product.productType === "MANUAL";
        const discountPercent = discountMap.get(product.id) ?? null;
        // AUTO_FETCH 在列表里按「有货」展示，不依赖库存数；
        // MANUAL + inventoryTracked: 使用 ProductVariant 库存聚合；
        // MANUAL + 不跟踪库存: 报告 stock=1 让前台永远显示有货（售罄状态仅由
        // variant.isActive 决定）。
        const stock = isAutoFetch
            ? 1
            : isManual
              ? product.inventoryTracked === true
                  ? (variantStockMap.get(product.id) ?? 0)
                  : 1
              : (stockMap.get(product.id) ?? 0);
        const manualPrices = isManual ? (variantPriceMap.get(product.id) ?? null) : null;
        return {
            ...productRest,
            price: Number(product.price),
            priceMin: manualPrices?.min ?? null,
            priceMax: manualPrices?.max ?? null,
            productType: product.productType ?? "NORMAL",
            stock,
            ...(discountPercent != null && { discountPercent }),
            ...(isAdmin && {
                sourceUrl: sourceUrl ?? null,
                costPerUnit: costPerUnit == null ? null : Number(costPerUnit),
            }),
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

    const { name, slug, description, summary, image, price, maxQuantity, status, tagIds, productType, sourceUrl, validityHours, allowAccountSwitch, accountSwitchLimit, couponEnabled, riskWarningEnabled, riskWarningTitle, riskWarningContent, riskWarningCountdown, riskWarningConfirmText, purchaseLimitEnabled, purchaseLimitQuantity, excludeFromAttribution, emailOnFulfill, variants } =
        parsed.data;

    // MANUAL ↔ variants contract:
    //  - MANUAL + ACTIVE: need at least one variant with isActive !== false,
    //    otherwise the product would be visible without any sellable SKU.
    //  - MANUAL + INACTIVE: variants optional (admin can fill them later).
    //  - non-MANUAL + non-empty variants: refuse to prevent stray writes.
    const targetStatus = status ?? "ACTIVE";
    if (productType === "MANUAL") {
        if (targetStatus === "ACTIVE") {
            const activeRows = (variants ?? []).filter(
                (v) => v.isActive !== false,
            );
            if (activeRows.length === 0) {
                return NextResponse.json(
                    {
                        error: "手动发货商品上架前需先创建至少一个启用的 SKU",
                        details:
                            "MANUAL + status=ACTIVE requires at least one variant with isActive !== false in the variants[] array.",
                    },
                    { status: 422 },
                );
            }
        }
    } else if (variants && variants.length > 0) {
        return NextResponse.json(
            {
                error: "仅手动发货商品（MANUAL）支持 SKU 列表",
                details:
                    "variants[] is only valid for productType=MANUAL; got " +
                    (productType ?? "NORMAL"),
            },
            { status: 422 },
        );
    }

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

    const productData = {
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
        emailOnFulfill: emailOnFulfill ?? false,
        tags:
            tagIds && tagIds.length > 0
                ? { connect: tagIds.map((id) => ({ id })) }
                : undefined,
    };

    // MANUAL with non-empty variants: atomic write so a half-created product
    // (no SKUs) can never appear on the storefront.
    const product =
        productType === "MANUAL" && variants && variants.length > 0
            ? await prisma.$transaction(async (tx) => {
                  const created = await tx.product.create({
                      data: productData,
                      include: {
                          tags: { select: { id: true, name: true, slug: true } },
                      },
                  });
                  await tx.productVariant.createMany({
                      data: variants.map((v) => ({
                          productId: created.id,
                          name: v.name,
                          price: v.price,
                          unitCost: v.unitCost ?? null,
                          stockQuantity: v.stockQuantity,
                          sortOrder: v.sortOrder ?? 0,
                          isActive: v.isActive ?? true,
                      })),
                  });
                  return created;
              })
            : await prisma.product.create({
                  data: productData,
                  include: {
                      tags: { select: { id: true, name: true, slug: true } },
                  },
              });

    revalidateProducts();

    return NextResponse.json(
        { ...product, price: Number(product.price) },
        { status: 201 }
    );
}

export const runtime = "nodejs";
