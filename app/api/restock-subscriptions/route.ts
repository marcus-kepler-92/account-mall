import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRestockSubscriptionSchema } from "@/lib/validations/restock-subscription";

/** Max PENDING subscriptions per email across all products (abuse prevention). */
const MAX_PENDING_SUBSCRIPTIONS_PER_EMAIL = 50;

function getClientIp(request: NextRequest): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first;
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;
    return "unknown";
}

/**
 * POST /api/restock-subscriptions
 * Public: create or refresh a restock subscription for a product.
 * - One subscription per (productId, IP): each IP can subscribe to each product at most once (DB unique on productId + ip).
 * - After a restock email is sent, status becomes NOTIFIED; same IP can subscribe again when product is out of stock to get the next restock reminder (二次提醒).
 * - Email is normalized (trim + lowercase). One email at most MAX_PENDING_SUBSCRIPTIONS_PER_EMAIL products.
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
    const ip = getClientIp(request);

    const pendingCount = await prisma.restockSubscription.count({
        where: { email: normalizedEmail, status: "PENDING" },
    });
    if (pendingCount >= MAX_PENDING_SUBSCRIPTIONS_PER_EMAIL) {
        return NextResponse.json(
            {
                error: "Subscription limit reached",
                message: `每个邮箱最多订阅 ${MAX_PENDING_SUBSCRIPTIONS_PER_EMAIL} 个商品的补货提醒，请先取消部分订阅后再试`,
            },
            { status: 400 }
        );
    }

    await prisma.restockSubscription.upsert({
        where: {
            productId_ip: { productId, ip },
        },
        create: {
            productId,
            ip,
            email: normalizedEmail,
            status: "PENDING",
        },
        update: {
            email: normalizedEmail,
            status: "PENDING",
            updatedAt: new Date(),
        },
    });

    return NextResponse.json({ ok: true, subscribed: true });
}

/**
 * GET /api/restock-subscriptions?productId=...&email=...
 * Public: check if this email has a PENDING subscription for the product.
 * - Email in query is normalized (trim + lowercase).
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

    const normalizedEmail = email.trim().toLowerCase();
    const subscription = await prisma.restockSubscription.findFirst({
        where: {
            productId: productId.trim(),
            email: normalizedEmail,
        },
        select: { status: true },
    });

    return NextResponse.json({
        subscribed:
            !!subscription && subscription.status === "PENDING",
    });
}

export const runtime = "nodejs";
