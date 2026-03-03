import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, notFound, badRequest, invalidJsonBody, validationError } from "@/lib/api-response";
import { patchCardStatusSchema } from "@/lib/validations/card";

type RouteContext = {
    params: Promise<{ cardId: string }>;
};

/**
 * PATCH /api/cards/[cardId]
 * Admin only: disable (UNSOLD -> DISABLED) or enable (DISABLED -> UNSOLD) a card.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { cardId } = await context.params;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = patchCardStatusSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const card = await prisma.card.findUnique({
        where: { id: cardId },
    });

    if (!card) {
        return notFound("Card not found");
    }

    const { status: targetStatus } = parsed.data;

    if (targetStatus === "DISABLED") {
        if (card.status !== "UNSOLD") {
            return badRequest("Only unsold cards can be disabled");
        }
        await prisma.card.update({
            where: { id: cardId },
            data: { status: "DISABLED" },
        });
        return NextResponse.json({ message: "Card disabled", status: "DISABLED" });
    }

    if (targetStatus === "UNSOLD") {
        if (card.status !== "DISABLED") {
            return badRequest("Only disabled cards can be re-enabled");
        }
        await prisma.card.update({
            where: { id: cardId },
            data: { status: "UNSOLD" },
        });
        return NextResponse.json({ message: "Card enabled", status: "UNSOLD" });
    }

    return badRequest("Invalid status");
}

/**
 * DELETE /api/cards/[cardId]
 * Admin only: delete a card. Only UNSOLD cards can be deleted.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { cardId } = await context.params;

    const card = await prisma.card.findUnique({
        where: { id: cardId },
    });

    if (!card) {
        return notFound("Card not found");
    }

    if (card.status !== "UNSOLD") {
        return badRequest("Only unsold cards can be deleted");
    }

    await prisma.card.delete({
        where: { id: cardId },
    });

    return NextResponse.json({ message: "Card deleted" });
}

export const runtime = "nodejs";
