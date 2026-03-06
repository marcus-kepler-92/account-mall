import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth-guard";
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response";
import { batchOrderActionSchema } from "@/lib/validations/order";

/**
 * POST /api/orders/batch
 * Admin only: batch close or delete orders.
 * - CLOSE: only PENDING orders can be closed (status -> CLOSED)
 * - DELETE: only CLOSED orders can be deleted
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

    const parsed = batchOrderActionSchema.safeParse(body);
    if (!parsed.success) {
        return validationError(parsed.error.flatten());
    }

    const { action, orderIds } = parsed.data;

    const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true },
    });

    const orderMap = new Map(orders.map((o) => [o.id, o.status]));

    let success = 0;
    let skipped = 0;
    const idsToProcess: string[] = [];

    for (const id of orderIds) {
        const status = orderMap.get(id);
        if (!status) {
            skipped++;
            continue;
        }

        if (action === "CLOSE") {
            if (status === "PENDING") {
                idsToProcess.push(id);
            } else {
                skipped++;
            }
        } else if (action === "DELETE") {
            if (status === "CLOSED") {
                idsToProcess.push(id);
            } else {
                skipped++;
            }
        }
    }

    if (idsToProcess.length > 0) {
        if (action === "CLOSE") {
            const result = await prisma.order.updateMany({
                where: { id: { in: idsToProcess } },
                data: { status: "CLOSED" },
            });
            success = result.count;
        } else if (action === "DELETE") {
            const result = await prisma.order.deleteMany({
                where: { id: { in: idsToProcess } },
            });
            success = result.count;
        }
    }

    return NextResponse.json({ success, skipped });
}

export const runtime = "nodejs";
