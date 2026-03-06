import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response";
import { batchCardActionSchema } from "@/lib/validations/card";

/**
 * POST /api/cards/batch
 * Admin only: batch delete/disable/enable cards.
 * - DELETE: only UNSOLD cards can be deleted
 * - DISABLE: only UNSOLD cards can be disabled
 * - ENABLE: only DISABLED cards can be enabled
 * Returns { success, skipped } counts.
 */
export async function POST(request: NextRequest) {
    const session = await getAdminSession();
    if (!session) {
        return unauthorized();
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return invalidJsonBody();
    }

    const parsed = batchCardActionSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const { action, cardIds } = parsed.data;

    const cards = await prisma.card.findMany({
        where: { id: { in: cardIds } },
        select: { id: true, status: true },
    });

    const cardMap = new Map(cards.map((c) => [c.id, c.status]));

    let success = 0;
    let skipped = 0;

    const idsToProcess: string[] = [];

    for (const id of cardIds) {
        const status = cardMap.get(id);
        if (!status) {
            skipped++;
            continue;
        }

        if (action === "DELETE") {
            if (status === "UNSOLD") {
                idsToProcess.push(id);
            } else {
                skipped++;
            }
        } else if (action === "DISABLE") {
            if (status === "UNSOLD") {
                idsToProcess.push(id);
            } else {
                skipped++;
            }
        } else if (action === "ENABLE") {
            if (status === "DISABLED") {
                idsToProcess.push(id);
            } else {
                skipped++;
            }
        }
    }

    if (idsToProcess.length > 0) {
        if (action === "DELETE") {
            const result = await prisma.card.deleteMany({
                where: { id: { in: idsToProcess } },
            });
            success = result.count;
        } else if (action === "DISABLE") {
            const result = await prisma.card.updateMany({
                where: { id: { in: idsToProcess } },
                data: { status: "DISABLED" },
            });
            success = result.count;
        } else if (action === "ENABLE") {
            const result = await prisma.card.updateMany({
                where: { id: { in: idsToProcess } },
                data: { status: "UNSOLD" },
            });
            success = result.count;
        }
    }

    return NextResponse.json({ success, skipped });
}

export const runtime = "nodejs";
