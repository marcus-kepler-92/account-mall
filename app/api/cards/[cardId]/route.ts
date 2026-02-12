import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";

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
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { cardId } = await context.params;

    const card = await prisma.card.findUnique({
        where: { id: cardId },
    });

    if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    if (card.status !== "UNSOLD") {
        return NextResponse.json(
            { error: "Only unsold cards can be deleted" },
            { status: 400 }
        );
    }

    await prisma.card.delete({
        where: { id: cardId },
    });

    return NextResponse.json({ message: "Card deleted" });
}

export const runtime = "nodejs";
