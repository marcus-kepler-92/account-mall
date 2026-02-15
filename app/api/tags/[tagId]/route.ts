import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, notFound } from "@/lib/api-response";

type RouteContext = {
    params: Promise<{ tagId: string }>;
};

/**
 * DELETE /api/tags/[tagId]
 * Admin only: delete a tag
 */
export async function DELETE(
    _request: NextRequest,
    context: RouteContext
) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    const { tagId } = await context.params;

    const existing = await prisma.tag.findUnique({
        where: { id: tagId },
    });
    if (!existing) {
        return notFound("Tag not found");
    }

    await prisma.tag.delete({
        where: { id: tagId },
    });

    return NextResponse.json({ message: "Tag deleted" });
}

export const runtime = "nodejs";
