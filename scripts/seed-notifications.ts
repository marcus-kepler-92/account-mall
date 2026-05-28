/**
 * Seed admin notification fixtures: 3 pending withdrawals, 2 open agent leads,
 * 1 out-of-stock + 1 low-stock NORMAL product, 3 awaiting/processing MANUAL orders.
 *
 * Idempotent: re-running cleans previously seeded rows (by `seed-notif-` slug /
 * orderNo / agent session id prefix) before re-creating.
 *
 *   npx tsx scripts/seed-notifications.ts
 */
import {
  PrismaClient,
  CardStatus,
  LeadStatus,
  LeadUrgency,
  OrderStatus,
  ProductStatus,
  ProductType,
  WithdrawalStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const PREFIX = "seed-notif";

async function cleanup() {
  // Order before Card before Product (FK direction)
  await prisma.order.deleteMany({
    where: { orderNo: { startsWith: `${PREFIX}-` } },
  });
  await prisma.card.deleteMany({
    where: { product: { slug: { startsWith: `${PREFIX}-` } } },
  });
  await prisma.product.deleteMany({
    where: { slug: { startsWith: `${PREFIX}-` } },
  });

  await prisma.agentLead.deleteMany({
    where: { session: { id: { startsWith: `${PREFIX}-` } } },
  });
  await prisma.agentSession.deleteMany({
    where: { id: { startsWith: `${PREFIX}-` } },
  });

  // Withdrawals carry no prefix-able field; clear ones we previously tagged via note.
  await prisma.withdrawal.deleteMany({
    where: { note: { startsWith: `${PREFIX}` } },
  });
}

async function main() {
  console.log(`[${PREFIX}] cleanup previous fixtures...`);
  await cleanup();

  // ── 1) Pick any existing distributor to bind withdrawals/orders ───────────
  const distributor = await prisma.user.findFirst({
    where: { role: "DISTRIBUTOR" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true },
  });
  if (!distributor) {
    throw new Error("No DISTRIBUTOR user found; please create one first.");
  }
  console.log(
    `[${PREFIX}] using distributor: ${distributor.name || distributor.email} (${distributor.id})`,
  );

  // ── 2) Withdrawals: 3 × PENDING ───────────────────────────────────────────
  await prisma.withdrawal.createMany({
    data: [
      {
        distributorId: distributor.id,
        amount: 150.5,
        status: WithdrawalStatus.PENDING,
        note: `${PREFIX}-1`,
      },
      {
        distributorId: distributor.id,
        amount: 320.0,
        status: WithdrawalStatus.PENDING,
        note: `${PREFIX}-2`,
      },
      {
        distributorId: distributor.id,
        amount: 88.0,
        status: WithdrawalStatus.PENDING,
        note: `${PREFIX}-3`,
      },
    ],
  });
  console.log(`[${PREFIX}] created 3 PENDING withdrawals`);

  // ── 3) Agent leads: 2 sessions × 1 lead (HIGH NEW, MED CONTACTED) ─────────
  const leadConfigs = [
    {
      wechat: "buyer_high_001",
      urgency: LeadUrgency.HIGH,
      status: LeadStatus.NEW,
      reason: "下单后无法收到卡密",
    },
    {
      wechat: "buyer_med_002",
      urgency: LeadUrgency.MED,
      status: LeadStatus.CONTACTED,
      reason: "咨询发货时间",
    },
  ];
  for (const [idx, cfg] of leadConfigs.entries()) {
    const session = await prisma.agentSession.create({
      data: {
        id: `${PREFIX}-session-${idx}`,
        fingerprintHash: `${PREFIX}-fp-${idx}`.padEnd(32, "x").slice(0, 32),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.agentLead.create({
      data: {
        sessionId: session.id,
        wechatId: cfg.wechat,
        reason: cfg.reason,
        urgency: cfg.urgency,
        status: cfg.status,
        conversationSnapshot: {
          messages: [
            { role: "user", content: cfg.reason },
            { role: "assistant", content: "正在为您升级人工..." },
          ],
        },
      },
    });
  }
  console.log(
    `[${PREFIX}] created 2 open agent leads (HIGH/NEW + MED/CONTACTED)`,
  );

  // ── 4) Inventory alerts: 1 OUT_OF_STOCK + 1 LOW_STOCK (NORMAL/ACTIVE) ─────
  await prisma.product.create({
    data: {
      name: "测试商品-缺货",
      slug: `${PREFIX}-oos`,
      price: 9.9,
      status: ProductStatus.ACTIVE,
      productType: ProductType.NORMAL,
    },
  });
  const lowStock = await prisma.product.create({
    data: {
      name: "测试商品-低库存",
      slug: `${PREFIX}-low`,
      price: 19.9,
      status: ProductStatus.ACTIVE,
      productType: ProductType.NORMAL,
    },
  });
  await prisma.card.createMany({
    data: [
      {
        productId: lowStock.id,
        content: "low-stock-card-1",
        status: CardStatus.UNSOLD,
      },
      {
        productId: lowStock.id,
        content: "low-stock-card-2",
        status: CardStatus.UNSOLD,
      },
    ],
  });
  console.log(
    `[${PREFIX}] created 1 OOS product + 1 LOW_STOCK product (2 unsold cards)`,
  );

  // ── 5) Manual pending orders: 3 × AWAITING/PROCESSING ─────────────────────
  const manualProduct = await prisma.product.create({
    data: {
      name: "测试商品-人工发货",
      slug: `${PREFIX}-manual`,
      price: 99.0,
      status: ProductStatus.ACTIVE,
      productType: ProductType.MANUAL,
    },
  });
  const now = Date.now();
  await prisma.order.createMany({
    data: [
      {
        orderNo: `${PREFIX}-order-1-${now}`,
        productId: manualProduct.id,
        distributorId: distributor.id,
        email: "buyer1@test.com",
        passwordHash: "$2a$10$seedhash",
        quantity: 1,
        amount: 99.0,
        status: OrderStatus.AWAITING_FULFILLMENT,
        productNameSnapshot: "测试商品-人工发货",
        paidAt: new Date(),
      },
      {
        orderNo: `${PREFIX}-order-2-${now}`,
        productId: manualProduct.id,
        distributorId: distributor.id,
        email: "buyer2@test.com",
        passwordHash: "$2a$10$seedhash",
        quantity: 2,
        amount: 198.0,
        status: OrderStatus.PROCESSING,
        productNameSnapshot: "测试商品-人工发货",
        paidAt: new Date(),
      },
      {
        orderNo: `${PREFIX}-order-3-${now}`,
        productId: manualProduct.id,
        distributorId: distributor.id,
        email: "buyer3@test.com",
        passwordHash: "$2a$10$seedhash",
        quantity: 1,
        amount: 99.0,
        status: OrderStatus.AWAITING_FULFILLMENT,
        productNameSnapshot: "测试商品-人工发货",
        dunCount: 2,
        lastDunAt: new Date(),
        paidAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      },
    ],
  });
  console.log(`[${PREFIX}] created 3 manual pending orders (1 dunned ×2)`);

  console.log("");
  console.log(`✅ ${PREFIX} seed complete. Refresh admin and open the bell:`);
  console.log("   - 提现待审核: 3");
  console.log("   - 客服跟进: 2 (1 HIGH/NEW + 1 MED/CONTACTED)");
  console.log("   - 库存预警: 2 (1 缺货 + 1 低库存)");
  console.log("   - 待发货订单: 3 (1 已催 2 次)");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
