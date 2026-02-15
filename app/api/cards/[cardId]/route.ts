import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, notFound, badRequest } from "@/lib/api-response";

type RouteContext = {
    params: Promise<{ cardId: string }>;
};

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
