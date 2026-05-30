import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOrderCompletionEmail } from "@/lib/order-completion-email";
import { createOrderCommissions } from "@/lib/calculate-order-commission";
import { checkAndIssueMilestoneBonuses } from "@/lib/domains/distributors";
import { decrementVariantStock } from "@/lib/domains/variants";
import { sendWecomNotification } from "@/lib/wecom-notify";
import { assertTransition } from "@/lib/order-state-machine";

// Sentinel errors used inside the MANUAL transaction to force a rollback while
// distinguishing the rollback reason from real DB failures.
class OutOfStockSentinel extends Error {
  constructor() {
    super("Out of stock")
    this.name = "OutOfStockSentinel"
  }
}
class ConcurrentCompletionSentinel extends Error {
  constructor() {
    super("Order already completed")
    this.name = "ConcurrentCompletionSentinel"
  }
}

export type CompletePendingOrderResult =
  | { done: true; orderNo: string }
  | { done: false; error: string };

/**
 * Complete a PENDING order by orderNo: set order to COMPLETED + paidAt, cards to SOLD, send completion email.
 * Idempotent for already COMPLETED orders (returns done: true without updating).
 * Returns { done: false, error } when order not found or not PENDING.
 * Throws when the transaction fails (e.g. DB error).
 *
 * Cost snapshot: aggregates Card.unitCost across RESERVED cards bound to this order and writes
 * the total into Order.costTotalSnapshot. Null unitCost values (pre-rollout cards) are treated
 * as 0, which biases profit upward on legacy data — accepted trade-off until backfill runs.
 */
export async function completePendingOrder(
  orderNo: string,
): Promise<CompletePendingOrderResult> {
  const order = await prisma.order.findFirst({
    where: { orderNo },
    include: {
      product: {
        select: {
          name: true,
          productType: true,
          validityHours: true,
          inventoryTracked: true,
          commissionMode: true,
          commissionValue: true,
        },
      },
      cards: { select: { id: true, status: true, unitCost: true } },
    },
  });
  if (!order) {
    return { done: false, error: "Order not found" };
  }
  if (order.status === "COMPLETED") {
    return { done: true, orderNo: order.orderNo };
  }
  if (order.status !== "PENDING") {
    return { done: false, error: "Order is not pending" };
  }

  // MANUAL orders take a separate path: stock is held on a ProductVariant
  // (not on Card rows), and the payment callback only advances the order to
  // AWAITING_FULFILLMENT. Card/commission/email handling is deferred until
  // the admin marks the order COMPLETED.
  if (order.product?.productType === "MANUAL") {
    return await completeManualOrder(order);
  }

  const now = new Date();
  const paidAt = now;

  // 付费 AUTO_FETCH：付款时才确定有效期起点，在此计算 expiresAt
  const isAutoFetch = order.product?.productType === "AUTO_FETCH";
  const validityHours = order.product?.validityHours ?? 24;
  const expiresAt =
    isAutoFetch && !order.expiresAt
      ? new Date(paidAt.getTime() + validityHours * 60 * 60 * 1000)
      : null;

  // Sum unitCost across the RESERVED cards this order is about to consume.
  // Done in integer cents to avoid floating-point drift across many rows.
  const costTotalCents = order.cards
    .filter((c) => c.status === "RESERVED")
    .reduce((sum, c) => {
      if (c.unitCost == null) return sum;
      const cents = Math.round(Number(c.unitCost) * 100);
      return sum + cents;
    }, 0);
  const costTotalSnapshot = new Prisma.Decimal(costTotalCents).div(100);

  let didUpdate = false;
  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "COMPLETED",
        paidAt,
        costTotalSnapshot,
        ...(expiresAt && { expiresAt }),
      },
    });
    if (updateResult.count > 0) {
      didUpdate = true;
      await tx.card.updateMany({
        where: { orderId: order.id, status: "RESERVED" },
        data: { status: "SOLD" },
      });
    }

    // Commission: only when we actually completed this order and order has a distributor
    if (!didUpdate) return;
    const distributorId = order.distributorId;
    if (distributorId) {
      await createOrderCommissions(tx, {
        orderId: order.id,
        distributorId,
        orderEmail: order.email ?? "",
        orderAmount: order.amount,
        discountPercentApplied: order.discountPercentApplied,
        paidAt,
        commissionMode: order.product?.commissionMode ?? "GLOBAL",
        commissionValue: order.product?.commissionValue ?? null,
        quantity: order.quantity,
      });
      await checkAndIssueMilestoneBonuses(tx, distributorId);
    }
  });

  if (didUpdate) {
    sendOrderCompletionEmail(order.id).catch((err) =>
      console.error("[order-completion-email]", err),
    );

    // Exit intent 折扣：订单真正完成时才记录使用记录，防止未付款占坑
    if (order.exitDiscountMeta) {
      writeExitDiscountUsage(order.id, order.exitDiscountMeta).catch((err) =>
        console.error("[exit-discount-usage]", err),
      );
    }
  }

  return { done: true, orderNo: order.orderNo };
}

/**
 * Payment callback path for MANUAL (人工发货) orders.
 *
 * Atomically: decrement the SKU's stock, then flip the order PENDING →
 * AWAITING_FULFILLMENT and snapshot the variant unit cost. Stock decrement
 * and status update share a transaction so a sold-out SKU rolls back the
 * status change too. After the transaction commits, fire a fire-and-forget
 * WeCom notification so ops sees the new order.
 *
 * Deferred to the COMPLETED transition (Task 12): card SOLD updates,
 * commissions, buyer email.
 */
async function completeManualOrder(
  order: {
    id: string
    orderNo: string
    variantId: string | null
    status: string
    amount: Prisma.Decimal
    email: string | null
    productNameSnapshot: string | null
    variantNameSnapshot: string | null
    product: { productType: string; inventoryTracked?: boolean } | null
  },
): Promise<CompletePendingOrderResult> {
  if (!order.variantId) {
    return { done: false, error: "MANUAL order missing variantId" }
  }
  assertTransition("PENDING", "AWAITING_FULFILLMENT", "MANUAL")

  const inventoryTracked = order.product?.inventoryTracked === true
  const paidAt = new Date()
  let stockOk = false

  await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id: order.variantId! },
    })
    if (!variant) throw new Error("Variant disappeared")

    // Untracked MANUAL: skip stock decrement entirely. The concurrent-
    // completion sentinel (Order.status updateMany guard below) still applies
    // — it protects against double-payment, not stock.
    if (inventoryTracked) {
      const decRes = await decrementVariantStock(order.variantId!, tx)
      if (decRes.count === 0) {
        throw new OutOfStockSentinel()
      }
    }

    // updateMany is required so the WHERE clause can include `status: "PENDING"`
    // (Prisma's `update` only accepts WhereUniqueInput). Without this guard a
    // concurrent payment retry could double-advance the order.
    const orderUpd = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: {
        status: "AWAITING_FULFILLMENT",
        paidAt,
        costTotalSnapshot: variant.unitCost ?? new Prisma.Decimal(0),
      },
    })
    if (orderUpd.count === 0) {
      throw new ConcurrentCompletionSentinel()
    }
    stockOk = true
  }).catch((err) => {
    if (
      err instanceof OutOfStockSentinel ||
      err instanceof ConcurrentCompletionSentinel
    ) {
      stockOk = false
      return
    }
    throw err
  })

  if (!stockOk) {
    console.warn(
      "[complete-manual] stock lock or status race for order",
      order.orderNo,
    )
    return {
      done: false,
      error: "Out of stock or already completed; order left as-is",
    }
  }

  sendWecomNotification("order.awaiting_fulfillment", {
    id: order.id,
    orderNo: order.orderNo,
    amount: order.amount,
    email: order.email,
    status: "AWAITING_FULFILLMENT",
    productNameSnapshot: order.productNameSnapshot,
    variantNameSnapshot: order.variantNameSnapshot,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).catch((err) => console.error("[wecom-notify]", err))

  return { done: true, orderNo: order.orderNo }
}

async function writeExitDiscountUsage(
  orderId: string,
  metaJson: string,
): Promise<void> {
  try {
    const meta = JSON.parse(metaJson) as {
      productId: string;
      visitorId: string;
      fingerprintHash: string;
      ip: string;
    };
    await prisma.exitDiscountUsage.upsert({
      where: { orderId },
      create: {
        productId: meta.productId,
        orderId,
        visitorId: meta.visitorId,
        fingerprintHash: meta.fingerprintHash,
        ip: meta.ip,
      },
      update: {},
    });
  } catch (err) {
    console.error("[exit-discount-usage] Failed to write usage record:", err);
  }
}
