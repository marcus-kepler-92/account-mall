import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, notFound } from "@/lib/api-response";

type RouteContext = {
    params: Promise<{ productId: string }>;
};

const VALID_STATUSES = ["UNSOLD", "RESERVED", "SOLD", "DISABLED"] as const;
type CardStatus = (typeof VALID_STATUSES)[number];

const STATUS_LABELS: Record<CardStatus, string> = {
    UNSOLD: "未售",
    RESERVED: "预占中",
    SOLD: "已售",
    DISABLED: "停用",
};

function sanitizeFilename(name: string): string {
    return name.replace(/[^\w\u4e00-\u9fa5\-_.]/g, "_");
}

/**
 * GET /api/products/[productId]/cards/export?status=UNSOLD
 * Admin only: export card contents as plain text attachment
 */
export async function GET(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { productId } = await context.params;

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true },
    });
    if (!product) {
        return notFound("Product not found");
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status");
    const status = VALID_STATUSES.includes(rawStatus as CardStatus)
        ? (rawStatus as CardStatus)
        : null;

    const cards = await prisma.card.findMany({
        where: { productId, ...(status ? { status } : {}) },
        select: { content: true },
        orderBy: { createdAt: "desc" },
    });

    const text = cards.map((c) => c.content).join("\n");

    const date = new Date().toISOString().slice(0, 10);
    const statusLabel = status ? STATUS_LABELS[status] : "全部";
    const safeName = sanitizeFilename(product.name);
    const filename = `${safeName}_卡密_${statusLabel}_${date}.txt`;
    const encodedFilename = encodeURIComponent(filename);

    return new Response(text, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
        },
    });
}

export const runtime = "nodejs";
