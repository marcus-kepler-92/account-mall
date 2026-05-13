import { Prisma } from "@prisma/client";
import { completePendingOrder } from "@/lib/complete-pending-order";
import { prismaMock } from "../../__mocks__/prisma";

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma");
  return { __esModule: true, prisma: prismaMock };
});

jest.mock("@/lib/order-completion-email", () => ({
  sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/config", () => ({
  getConfig: jest.fn(() => ({ invitationRewardAmount: 5 })),
}));

function makePendingOrderWithMeta(exitDiscountMeta: string | null = null) {
  return {
    id: "ord_1",
    orderNo: "order-1",
    status: "PENDING",
    amount: new Prisma.Decimal("95"),
    quantity: 1,
    email: "buyer@example.com",
    distributorId: null as string | null,
    discountPercentApplied: null,
    exitDiscountMeta,
    product: { name: "Test" },
    cards: [{ id: "c1", status: "RESERVED" }],
  } as any;
}

const validMeta = JSON.stringify({
  productId: "prod_1",
  visitorId: "visitor-abc",
  fingerprintHash: "fp-xyz",
  ip: "127.0.0.1",
  discountPercent: 5,
});

describe("completePendingOrder -- ExitDiscountUsage write", () => {
  beforeEach(() => {
    prismaMock.order.findFirst.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.exitDiscountUsage.upsert.mockReset();
    prismaMock.order.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(
      (async (fn: (tx: any) => Promise<void>) => {
        await fn(prismaMock);
      }) as any,
    );
  });

  it("calls exitDiscountUsage.upsert with correct data when exitDiscountMeta is present on PENDING order", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makePendingOrderWithMeta(validMeta),
    );
    prismaMock.exitDiscountUsage.upsert.mockResolvedValue({} as any);

    await completePendingOrder("order-1");

    // Fire-and-forget: wait for the promise to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(prismaMock.exitDiscountUsage.upsert).toHaveBeenCalledWith({
      where: { orderId: "ord_1" },
      create: {
        productId: "prod_1",
        orderId: "ord_1",
        visitorId: "visitor-abc",
        fingerprintHash: "fp-xyz",
        ip: "127.0.0.1",
      },
      update: {},
    });
  });

  it("does not call exitDiscountUsage.upsert when exitDiscountMeta is null", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makePendingOrderWithMeta(null),
    );

    await completePendingOrder("order-1");
    await new Promise((r) => setTimeout(r, 10));

    expect(prismaMock.exitDiscountUsage.upsert).not.toHaveBeenCalled();
  });

  it("does not block order completion when exitDiscountUsage.upsert throws", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makePendingOrderWithMeta(validMeta),
    );
    prismaMock.exitDiscountUsage.upsert.mockRejectedValue(
      new Error("DB write failed"),
    );

    // completePendingOrder should still succeed
    const result = await completePendingOrder("order-1");
    await new Promise((r) => setTimeout(r, 10));

    expect(result).toEqual({ done: true, orderNo: "order-1" });
  });

  it("does not call exitDiscountUsage.upsert when order is already COMPLETED (idempotent path)", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      ...makePendingOrderWithMeta(validMeta),
      status: "COMPLETED",
    });

    await completePendingOrder("order-1");
    await new Promise((r) => setTimeout(r, 10));

    // COMPLETED path returns early, no transaction runs, no usage record
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.exitDiscountUsage.upsert).not.toHaveBeenCalled();
  });

  it("calling completePendingOrder twice on same order does not throw (upsert is idempotent)", async () => {
    // First call: transaction succeeds, upsert succeeds
    prismaMock.order.findFirst.mockResolvedValue(
      makePendingOrderWithMeta(validMeta),
    );
    prismaMock.exitDiscountUsage.upsert.mockResolvedValue({} as any);

    await completePendingOrder("order-1");
    await new Promise((r) => setTimeout(r, 10));

    // Second call: order is now COMPLETED, early return — no upsert
    prismaMock.order.findFirst.mockResolvedValue({
      ...makePendingOrderWithMeta(validMeta),
      status: "COMPLETED",
    });

    const result = await completePendingOrder("order-1");
    await new Promise((r) => setTimeout(r, 10));

    expect(result).toEqual({ done: true, orderNo: "order-1" });
    // upsert called exactly once (first call only)
    expect(prismaMock.exitDiscountUsage.upsert).toHaveBeenCalledTimes(1);
  });

  it("upsert called concurrently on same order does not throw (P2002 safe)", async () => {
    prismaMock.order.findFirst.mockResolvedValue(
      makePendingOrderWithMeta(validMeta),
    );
    // Simulate the second concurrent call hitting a unique constraint
    prismaMock.exitDiscountUsage.upsert
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint"), { code: "P2002" }));

    // Both calls complete without throwing
    const [r1, r2] = await Promise.all([
      completePendingOrder("order-1"),
      completePendingOrder("order-1"),
    ]);
    await new Promise((r) => setTimeout(r, 10));

    expect(r1).toEqual({ done: true, orderNo: "order-1" });
    expect(r2).toEqual({ done: true, orderNo: "order-1" });
  });
});
