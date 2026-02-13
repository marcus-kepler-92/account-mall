import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRestockSubscriptionSchema } from "@/lib/validations/restock-subscription";

/**
 * POST /api/restock-subscriptions
 * Public: create or refresh a restock subscription for a product.
 */
export async function POST(request: NextRequest) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = createRestockSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: parsed.error.flatten(),
            },
            { status: 400 }
        );
    }

    const { productId, email } = parsed.data;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
        },
    });

    if (!product || product.status !== "ACTIVE") {
        return NextResponse.json(
            { error: "Product not found or unavailable" },
            { status: 404 }
        );
    }

    const unsoldCount = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    });

    if (unsoldCount > 0) {
        return NextResponse.json(
            {
                error: "Product is in stock",
                message: "当前有货，可直接下单购买",
            },
            { status: 400 }
        );
    }

    const normalizedEmail = email.trim().toLowerCase();

    await prisma.restockSubscription.upsert({
        where: {
            productId_email: { productId, email: normalizedEmail },
        },
        create: {
            productId,
            email: normalizedEmail,
            status: "PENDING",
        },
        update: {
            status: "PENDING",
            updatedAt: new Date(),
        },
    });

    return NextResponse.json({ ok: true, subscribed: true });
}

/**
 * GET /api/restock-subscriptions?productId=...&email=...
 * Public: check if user has already subscribed for a product.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const email = searchParams.get("email");

    if (!productId?.trim() || !email?.trim()) {
        return NextResponse.json(
            { error: "productId and email are required" },
            { status: 400 }
        );
    }

    const subscription = await prisma.restockSubscription.findUnique({
        where: {
            productId_email: {
                productId: productId.trim(),
                email: email.trim().toLowerCase(),
            },
        },
        select: { status: true },
    });

    return NextResponse.json({
        subscribed:
            !!subscription && subscription.status === "PENDING",
    });
}

export const runtime = "nodejs";
