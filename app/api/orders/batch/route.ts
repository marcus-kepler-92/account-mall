import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard";
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

    if (action === "DELETE") {
        const superSession = await getSuperAdminSession();
        if (!superSession) return unauthorized();
    }

    const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true, product: { select: { productType: true } } },
    });

    const orderMap = new Map(orders.map((o) => [o.id, o]));

    let success = 0;
    let skipped = 0;
    const idsToProcess: string[] = [];

    for (const id of orderIds) {
        const status = orderMap.get(id)?.status;
        if (!status) {
            skipped++;
            continue;
        }

        // CLOSE is intentionally restricted to PENDING orders only (spec non-goal:
        // no batch CLOSE on AWAITING_FULFILLMENT/PROCESSING — variant stock rollback
        // is handled per-order, not in batch).
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
            // Direct status write bypasses assertTransition(): the loop above
            // filtered idsToProcess to status="PENDING" only, and PENDING→CLOSED
            // is legal for ALL product types per lib/order-state-machine.ts.
            // The pre-filter is the source-of-truth guard here.
            //
            // Closing a PENDING order must also release its reserved cards, same
            // as the single-order PATCH/DELETE and the close-expired-orders cron:
            // - AUTO_FETCH: temporary crawled cards can't return to stock → delete
            // - NORMAL/MANUAL: release reserved cards back to inventory
            const autoFetchIds = idsToProcess.filter(
                (id) => orderMap.get(id)?.product?.productType === "AUTO_FETCH",
            );
            const releaseIds = idsToProcess.filter(
                (id) => orderMap.get(id)?.product?.productType !== "AUTO_FETCH",
            );
            await prisma.$transaction(async (tx) => {
                await tx.order.updateMany({
                    where: { id: { in: idsToProcess } },
                    data: { status: "CLOSED" },
                });
                if (autoFetchIds.length > 0) {
                    await tx.card.deleteMany({
                        where: { orderId: { in: autoFetchIds }, status: "RESERVED" },
                    });
                }
                if (releaseIds.length > 0) {
                    await tx.card.updateMany({
                        where: { orderId: { in: releaseIds }, status: "RESERVED" },
                        data: { status: "UNSOLD", orderId: null },
                    });
                }
            });
            success = idsToProcess.length;
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
