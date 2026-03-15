/**
 * AUTO_FETCH 下单——多因素限领逻辑测试
 *
 * 验证三信号（邮箱 / 浏览器指纹 / IP辅助）的组合拦截与放行逻辑，
 * 以及 fingerprintHash 存储到订单和用户友好错误文案。
 */
import { type NextRequest } from "next/server";
import { POST } from "@/app/api/orders/route";
import { prismaMock } from "../../__mocks__/prisma";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
  const { prismaMock } = require("../../__mocks__/prisma");
  return { __esModule: true, prisma: prismaMock };
});

jest.mock("@/lib/auth-guard", () => ({
  __esModule: true,
  getAdminSession: jest.fn(),
}));

jest.mock("better-auth/crypto", () => ({
  __esModule: true,
  hashPassword: jest.fn().mockResolvedValue("hashed-pw"),
}));

jest.mock("@/lib/rate-limit", () => ({
  __esModule: true,
  checkOrderCreateRateLimit: jest.fn().mockResolvedValue(null),
  getClientIp: jest.fn().mockReturnValue("1.2.3.4"),
  MAX_PENDING_ORDERS_PER_IP: 3,
}));

jest.mock("@/lib/get-payment-url", () => ({
  getPaymentUrlForOrder: jest.fn().mockReturnValue("https://pay.example.com/pay"),
}));

jest.mock("@/lib/config", () => {
  const mock = {
    turnstileSecretKey: undefined as string | undefined,
    nodeEnv: "test" as string,
    siteUrl: "http://localhost:3000",
    autoFetchMaxQuantityPerOrder: 1,
    autoFetchCooldownHours: 24,
    autoFetchSourceUrl: "https://source.example.com",
    pendingOrderTimeoutMs: 900_000,
    exitDiscountSecret: undefined as string | undefined,
  };
  (global as { __configMockFp?: typeof mock }).__configMockFp = mock;
  return { config: mock, getConfig: () => mock };
});

jest.mock("@/lib/turnstile", () => ({ verifyTurnstileToken: jest.fn() }));

jest.mock("@/lib/complete-pending-order", () => ({
  completePendingOrder: jest.fn(),
}));

jest.mock("@/lib/order-success-token", () => ({
  createOrderSuccessToken: jest.fn().mockReturnValue("mock-success-token"),
}));

jest.mock("@/lib/scrape-shared-accounts", () => ({
  scrapeSharedAccounts: jest.fn(),
}));

import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts";
const scrapeSharedAccountsMock = scrapeSharedAccounts as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConfig() {
  return (global as { __configMockFp?: Record<string, unknown> })
    .__configMockFp!;
}

const SCRAPED_ACCOUNT = {
  account: "shared@apple.com",
  password: "Pass123!",
  region: "US",
  status: "valid",
};

function makeFreeAutoFetchProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_free",
    name: "Free AutoFetch Account",
    price: 0,
    maxQuantity: 1,
    status: "ACTIVE",
    productType: "AUTO_FETCH",
    sourceUrl: "https://source.example.com",
    validityHours: 24,
    ...overrides,
  };
}

function makePaidAutoFetchProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_paid",
    name: "Paid AutoFetch Account",
    price: 19.9,
    maxQuantity: 1,
    status: "ACTIVE",
    productType: "AUTO_FETCH",
    sourceUrl: "https://source.example.com",
    validityHours: 24,
    ...overrides,
  };
}

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

/** 成功创建订单所需的 transaction mock */
function mockSuccessfulFreeTransaction() {
  prismaMock.$transaction.mockImplementation(async (fn: Function) => {
    const tx = {
      order: {
        create: jest.fn().mockResolvedValue({ id: "ord_1", orderNo: "uuid-1" }),
      },
      card: {
        create: jest.fn().mockResolvedValue({ id: "card_1" }),
      },
    };
    await fn(tx);
    return { orderNo: "uuid-1" };
  });
}

const BASE_BODY = {
  productId: "prod_free",
  email: "user@example.com",
  orderPassword: "password123",
  quantity: 1,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/orders — AUTO_FETCH 多因素限领", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getConfig().nodeEnv = "test";
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.user.findFirst.mockResolvedValue(null);
    scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT]);
  });

  // ─── 免费商品拦截 ─────────────────────────────────────────────────────────

  describe("免费 AUTO_FETCH — 活跃订单拦截", () => {
    it("邮箱命中活跃订单 → 返回 429", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
      });

      const res = await POST(makeRequest(BASE_BODY));

      expect(res.status).toBe(429);
    });

    it("指纹命中活跃订单（邮箱不同） → 返回 429", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
      });

      const res = await POST(
        makeRequest({
          ...BASE_BODY,
          email: "other@example.com", // 不同邮箱
          fingerprintHash: "fp-abc123", // 指纹命中
        }),
      );

      expect(res.status).toBe(429);
    });

    it("IP + 邮箱辅助命中 → 返回 429", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
      });

      const res = await POST(makeRequest(BASE_BODY));

      expect(res.status).toBe(429);
    });

    it("无任何活跃订单 → 允许下单（200）", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null); // 无活跃订单
      mockSuccessfulFreeTransaction();

      const res = await POST(makeRequest(BASE_BODY));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.orderNo).toBeDefined();
    });
  });

  // ─── WHERE 子句参数验证 ───────────────────────────────────────────────────

  describe("活跃订单查询 WHERE 子句", () => {
    it("仅邮箱（无指纹）→ ownerCondition 只含 email", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: undefined }));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      const ownerOR: object[] = call.where.AND[1].OR;
      // 只有邮箱 + IP辅助（无指纹），确认没有 fingerprintHash 独立信号
      const hasStandaloneFingerprint = ownerOR.some(
        (c) => "fingerprintHash" in c && !("clientIp" in c),
      );
      expect(hasStandaloneFingerprint).toBe(false);
    });

    it("有指纹 → ownerCondition 含独立 fingerprintHash 信号", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-xyz" }));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      const ownerOR: object[] = call.where.AND[1].OR;
      const hasStandaloneFingerprint = ownerOR.some(
        (c) =>
          (c as Record<string, unknown>).fingerprintHash === "fp-xyz" &&
          !("clientIp" in c),
      );
      expect(hasStandaloneFingerprint).toBe(true);
    });

    it("IP 辅助条件带 OR [email, fingerprint]", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-abc" }));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      const ownerOR: object[] = call.where.AND[1].OR;
      const ipEntry = ownerOR.find((c) => "clientIp" in c) as
        | Record<string, unknown>
        | undefined;
      expect(ipEntry).toBeDefined();
      const ipSubOR = (ipEntry?.OR as object[]) ?? [];
      const hasEmailInIp = ipSubOR.some(
        (c) => (c as Record<string, unknown>).email !== undefined,
      );
      const hasFpInIp = ipSubOR.some(
        (c) => (c as Record<string, unknown>).fingerprintHash === "fp-abc",
      );
      expect(hasEmailInIp).toBe(true);
      expect(hasFpInIp).toBe(true);
    });

    it("免费商品 → WHERE 含 amount: { equals: 0 }", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest(BASE_BODY));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      expect(call.where.amount).toEqual({ equals: 0 });
    });

    it("收费商品 → WHERE 不含 amount 过滤", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makePaidAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      // paid 流程需要 transaction mock
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: {
            create: jest
              .fn()
              .mockResolvedValue({ id: "o1", orderNo: "uuid-paid" }),
          },
          card: { create: jest.fn().mockResolvedValue({ id: "c1" }) },
        };
        await fn(tx);
        return { orderNo: "uuid-paid", orderId: "o1" };
      });

      await POST(makeRequest({ ...BASE_BODY, productId: "prod_paid" }));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      expect(call.where.amount).toBeUndefined();
    });
  });

  // ─── fingerprintHash 存储 ─────────────────────────────────────────────────

  describe("fingerprintHash 写入订单", () => {
    it("下单时有指纹 → fingerprintHash 存入 order.create data", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);

      let capturedOrderData: Record<string, unknown> | undefined;
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: {
            create: jest
              .fn()
              .mockImplementation(
                async (args: { data: Record<string, unknown> }) => {
                  capturedOrderData = args.data;
                  return { id: "ord_1", orderNo: "uuid-1" };
                },
              ),
          },
          card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
        };
        await fn(tx);
        return { orderNo: "uuid-1" };
      });

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-stored" }));

      expect(capturedOrderData?.fingerprintHash).toBe("fp-stored");
    });

    it("下单时无指纹 → fingerprintHash 不出现在 order.create data", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);

      let capturedOrderData: Record<string, unknown> | undefined;
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: {
            create: jest
              .fn()
              .mockImplementation(
                async (args: { data: Record<string, unknown> }) => {
                  capturedOrderData = args.data;
                  return { id: "ord_1", orderNo: "uuid-1" };
                },
              ),
          },
          card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
        };
        await fn(tx);
        return { orderNo: "uuid-1" };
      });

      await POST(makeRequest(BASE_BODY)); // 无 fingerprintHash

      expect(capturedOrderData?.fingerprintHash).toBeUndefined();
    });

    it("空字符串指纹视为无指纹 → 不写入", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);

      let capturedOrderData: Record<string, unknown> | undefined;
      prismaMock.$transaction.mockImplementation(async (fn: Function) => {
        const tx = {
          order: {
            create: jest
              .fn()
              .mockImplementation(
                async (args: { data: Record<string, unknown> }) => {
                  capturedOrderData = args.data;
                  return { id: "ord_1", orderNo: "uuid-1" };
                },
              ),
          },
          card: { create: jest.fn().mockResolvedValue({ id: "card_1" }) },
        };
        await fn(tx);
        return { orderNo: "uuid-1" };
      });

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "" }));

      expect(capturedOrderData?.fingerprintHash).toBeUndefined();
    });
  });

  // ─── 错误文案 ─────────────────────────────────────────────────────────────

  describe("被拦截时的错误文案", () => {
    it("免费商品被拦截 → 错误含「今日已领取」", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
      });

      const res = await POST(makeRequest(BASE_BODY));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("今日已领取");
    });

    it("免费商品被拦截且有 expiresAt → 错误含到期时间信息", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      const expiresAt = new Date(Date.now() + 3600_000); // 1 小时后
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt,
      });

      const res = await POST(makeRequest(BASE_BODY));
      const data = await res.json();

      expect(res.status).toBe(429);
      // 包含可用至 xx:xx 格式
      expect(data.error).toContain("可使用至");
    });

    it("收费商品被拦截 → 错误含「活跃订单」而非「今日已领取」", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makePaidAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
      });

      const res = await POST(
        makeRequest({ ...BASE_BODY, productId: "prod_paid" }),
      );
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("活跃订单");
      expect(data.error).not.toContain("今日已领取");
    });
  });

  // ─── 开发模式 ─────────────────────────────────────────────────────────────

  describe("开发模式跳过检查", () => {
    it("nodeEnv=development → 不调用 order.findFirst 检查，直接下单", async () => {
      getConfig().nodeEnv = "development";
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      mockSuccessfulFreeTransaction();

      await POST(makeRequest(BASE_BODY));

      // development 模式下不应执行活跃订单检查
      expect(prismaMock.order.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── 时间窗口条件 ─────────────────────────────────────────────────────────

  describe("时间窗口 WHERE 条件", () => {
    it("查询包含 expiresAt null 的冷却时间窗口（旧数据兜底）", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      const before = Date.now();
      await POST(makeRequest(BASE_BODY));
      const after = Date.now();

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      const timeOR = call.where.AND[0].OR as object[];

      // 第一个条件：expiresAt null + createdAt >= cooldownStart
      const nullExpiryBranch = timeOR.find(
        (c) => (c as Record<string, unknown>).expiresAt === null,
      ) as Record<string, unknown> | undefined;
      expect(nullExpiryBranch).toBeDefined();
      const gte = (nullExpiryBranch?.createdAt as Record<string, Date>)?.gte;
      expect(gte).toBeDefined();
      // cooldownStart = now - 24h；允许 ±2s 误差
      const expectedMs = 24 * 60 * 60 * 1000;
      expect(before - gte.getTime()).toBeCloseTo(expectedMs, -3);
      expect(after - gte.getTime()).toBeCloseTo(expectedMs, -3);
    });

    it("查询包含 expiresAt > now 的活跃条件", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      const before = Date.now();
      await POST(makeRequest(BASE_BODY));

      const call = prismaMock.order.findFirst.mock.calls[0][0];
      const timeOR = call.where.AND[0].OR as object[];

      const activeExpiryBranch = timeOR.find(
        (c) =>
          (c as Record<string, unknown>).expiresAt !== null &&
          (c as Record<string, unknown>).expiresAt !== undefined,
      ) as Record<string, unknown> | undefined;
      expect(activeExpiryBranch).toBeDefined();
      const gt = (activeExpiryBranch?.expiresAt as Record<string, Date>)?.gt;
      expect(gt).toBeDefined();
      // gt 应接近当前时间
      expect(Math.abs(gt.getTime() - before)).toBeLessThan(2000);
    });
  });

  // ─── 过期订单不阻断 ───────────────────────────────────────────────────────

  describe("已过期订单不阻断新下单", () => {
    it("同邮箱 expiresAt 已过期的历史订单 → findFirst 返回 null → 允许下单（200）", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct())
      // findFirst 返回 null 模拟「数据库未找到活跃订单」（即过期订单被 WHERE 条件排除）
      prismaMock.order.findFirst.mockResolvedValue(null)
      mockSuccessfulFreeTransaction()

      const res = await POST(makeRequest(BASE_BODY))

      expect(res.status).toBe(200)
    })

    it("WHERE 条件 expiresAt.gt 确保只查未过期订单", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct())
      prismaMock.order.findFirst.mockResolvedValue(null)
      mockSuccessfulFreeTransaction()

      const now = Date.now()
      await POST(makeRequest(BASE_BODY))

      const call = prismaMock.order.findFirst.mock.calls[0][0]
      const timeOR = call.where.AND[0].OR as object[]
      const activeExpiryBranch = timeOR.find(
          (c) => (c as Record<string, unknown>).expiresAt !== null &&
              (c as Record<string, unknown>).expiresAt !== undefined
      ) as Record<string, unknown> | undefined
      const gt = (activeExpiryBranch?.expiresAt as Record<string, Date>)?.gt
      // gt 必须 ≤ now（只查「当前时间之后到期」的订单）
      expect(gt.getTime()).toBeLessThanOrEqual(now + 100)
    })
  })

  // ─── 免费 AUTO_FETCH 成功响应 ─────────────────────────────────────────────

  describe("免费 AUTO_FETCH 成功下单响应", () => {
    it("返回 successToken + expiresAt + claimedAccount", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct())
      prismaMock.order.findFirst.mockResolvedValue(null)
      mockSuccessfulFreeTransaction()

      const before = Date.now()
      const res = await POST(makeRequest(BASE_BODY))
      const after = Date.now()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.orderNo).toBeDefined()
      expect(data.successToken).toBe("mock-success-token")
      expect(data.amount).toBe(0)
      expect(data.paymentUrl).toBeNull()

      // claimedAccount 含爬取到的账号信息
      expect(data.claimedAccount).toBeDefined()
      expect(data.claimedAccount.account).toBe(SCRAPED_ACCOUNT.account)
      expect(data.claimedAccount.password).toBe(SCRAPED_ACCOUNT.password)

      // expiresAt 约等于 now + 24h
      const expiresAt = new Date(data.expiresAt).getTime()
      const expectedMs = 24 * 60 * 60 * 1000
      expect(expiresAt - before).toBeGreaterThanOrEqual(expectedMs - 1000)
      expect(expiresAt - after).toBeLessThanOrEqual(expectedMs + 1000)
    })

    it("validityHours=48 → expiresAt 为 48 小时后", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
          makeFreeAutoFetchProduct({ validityHours: 48 })
      )
      prismaMock.order.findFirst.mockResolvedValue(null)
      mockSuccessfulFreeTransaction()

      const before = Date.now()
      const res = await POST(makeRequest(BASE_BODY))
      const data = await res.json()

      const expiresAt = new Date(data.expiresAt).getTime()
      const expectedMs = 48 * 60 * 60 * 1000
      expect(expiresAt - before).toBeGreaterThanOrEqual(expectedMs - 1000)
      expect(expiresAt - before).toBeLessThanOrEqual(expectedMs + 2000)
    })
  })
});
