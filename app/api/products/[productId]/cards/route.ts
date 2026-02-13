import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { bulkImportCardsSchema } from "@/lib/validations/card";
import { notifyRestockSubscribers } from "@/lib/restock-notify";

type RouteContext = {
    params: Promise<{ productId: string }>;
};

/**
 * GET /api/products/[productId]/cards
 * Admin only: list all cards for a product, optionally filter by status
 */
export async function GET(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await context.params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // UNSOLD | RESERVED | SOLD | null (all)

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
    });
    if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const where: { productId: string; status?: "UNSOLD" | "RESERVED" | "SOLD" } = {
        productId,
    };
    if (status === "UNSOLD" || status === "RESERVED" || status === "SOLD") {
        where.status = status;
    }

    const [cards, counts] = await Promise.all([
        prisma.card.findMany({
            where,
            include: {
                order: { select: { orderNo: true } },
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.card.groupBy({
            by: ["status"],
            where: { productId },
            _count: { id: true },
        }),
    ]);

    const stats = {
        UNSOLD: counts.find((c) => c.status === "UNSOLD")?._count.id ?? 0,
        RESERVED: counts.find((c) => c.status === "RESERVED")?._count.id ?? 0,
        SOLD: counts.find((c) => c.status === "SOLD")?._count.id ?? 0,
    };

    const serialized = cards.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        orderNo: c.order?.orderNo ?? null,
        createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ cards: serialized, stats });
}

/**
 * POST /api/products/[productId]/cards
 * Admin only: bulk import cards
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId } = await context.params;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
    });
    if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = bulkImportCardsSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const contents = [...new Set(parsed.data.contents.map((c) => c.trim()).filter(Boolean))];
    if (contents.length === 0) {
        return NextResponse.json(
            { error: "No valid card contents to import" },
            { status: 400 }
        );
    }

    const oldUnsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    });

    const { count } = await prisma.card.createMany({
        data: contents.map((content) => ({
            productId,
            content,
            status: "UNSOLD",
        })),
    });

    if (oldUnsoldCount === 0 && count > 0) {
        const productWithDetails = await prisma.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, slug: true, price: true },
        });
        if (productWithDetails) {
            notifyRestockSubscribers({
                id: productWithDetails.id,
                name: productWithDetails.name,
                slug: productWithDetails.slug,
                price: Number(productWithDetails.price),
            }).catch((err) => {
                console.error("[restock-notify] Failed to send restock emails:", err);
            });
        }
    }

    return NextResponse.json({ imported: count, total: contents.length }, { status: 201 });
}

export const runtime = "nodejs";
