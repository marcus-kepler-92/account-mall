/**
 * AUTO_FETCH 下单——多因素限领逻辑测试
 *
 * 验证三信号（邮箱 / 浏览器指纹 / IP辅助）的组合拦截与放行逻辑，
 * 以及 fingerprintHash 存储到订单和用户友好错误文案。
 */
import { type NextRequest } from "next/server";
import { POST } from "@/app/api/orders/route";
import { prismaMock } from "../../__mocks__/prisma";
import { Prisma } from "@prisma/client";

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
    autoFetchSourceUrls: ["https://source.example.com"],
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
  scrapeMultipleUrls: jest.fn(),
}));

import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts";
const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock;

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
    slug: "free-autofetch-account",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("0"),
    maxQuantity: 1,
    status: "ACTIVE",
    productType: "AUTO_FETCH",
    sourceUrl: "https://source.example.com",
    validityHours: 24,
    allowAccountSwitch: true,
    accountSwitchLimit: 1,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

function makePaidAutoFetchProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod_paid",
    name: "Paid AutoFetch Account",
    slug: "paid-autofetch-account",
    summary: null,
    description: null,
    image: null,
    price: new Prisma.Decimal("19.9"),
    maxQuantity: 1,
    status: "ACTIVE",
    productType: "AUTO_FETCH",
    sourceUrl: "https://source.example.com",
    validityHours: 24,
    allowAccountSwitch: true,
    accountSwitchLimit: 1,
    riskWarningEnabled: false,
    riskWarningTitle: null,
    riskWarningContent: null,
    riskWarningCountdown: null,
    riskWarningConfirmText: null,
    pinnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

function makeRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
  } as unknown as NextRequest;
}

/** 成功创建订单所需的 transaction mock */
function mockSuccessfulFreeTransaction() {
  (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
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
    scrapeMultipleUrlsMock.mockResolvedValue([SCRAPED_ACCOUNT]);
    prismaMock.accountBlacklist.findMany.mockResolvedValue([]);
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
      } as any);

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
      } as any);

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
      } as any);

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

    it("Safari 碰撞：换邮箱 + 换 IP + 同指纹 → WHERE 无法命中 → 允许下单（200）", async () => {
      const { getClientIp } = require("@/lib/rate-limit");
      getClientIp.mockReturnValueOnce("9.9.9.9"); // 不同 IP
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct());
      prismaMock.order.findFirst.mockResolvedValue(null); // 无佐证信号，WHERE 不命中
      mockSuccessfulFreeTransaction();

      const res = await POST(makeRequest({
        ...BASE_BODY,
        email: "victim@example.com",
        fingerprintHash: "fp-safari-collision",
      }));

      expect(res.status).toBe(200);
    });

    it("换邮箱 + 同 IP + 同指纹 → 指纹+IP 佐证命中 → 返回 429，不暴露他人 orderNo", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct());
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
        orderNo: "original-order-uuid",
        email: "original@example.com", // 与请求邮箱不同
      } as any);

      const res = await POST(makeRequest({
        ...BASE_BODY,
        email: "attacker@example.com",
        fingerprintHash: "fp-abc123", // 同指纹 + 同 IP（mock 默认 1.2.3.4）
      }));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.orderNo).toBeUndefined(); // 不泄露他人订单号
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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const ownerOR: object[] = (call.where!.AND as any)[1].OR;
      // 只有邮箱 + IP辅助（无指纹），确认没有 fingerprintHash 独立信号
      const hasStandaloneFingerprint = ownerOR.some(
        (c) => "fingerprintHash" in c && !("clientIp" in c),
      );
      expect(hasStandaloneFingerprint).toBe(false);
    });

    it("有指纹 → ownerCondition 含辅助指纹信号（需佐证，不独立）", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-xyz" }));

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const ownerOR: object[] = (call.where!.AND as any)[1].OR;

      // Fingerprint should be auxiliary — paired with OR corroboration, not standalone
      const fpEntry = ownerOR.find(
        (c) => (c as Record<string, unknown>).fingerprintHash === "fp-xyz",
      ) as Record<string, unknown> | undefined;
      expect(fpEntry).toBeDefined();
      // Must have an OR sub-condition (corroboration), not a bare { fingerprintHash } signal
      expect(fpEntry!.OR).toBeDefined();
      expect((fpEntry!.OR as object[]).length).toBeGreaterThan(0);
    });

    it("Safari 碰撞场景：指纹相同但邮箱和 IP 均不同 → WHERE 中指纹条件携带佐证（不单独触发）", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, email: "safari-user@example.com", fingerprintHash: "fp-collision" }));

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const ownerOR: object[] = (call.where!.AND as any)[1].OR;

      // There must be NO bare { fingerprintHash } entry — fingerprint alone should not block
      const hasStandaloneFingerprint = ownerOR.some(
        (c) => {
          const keys = Object.keys(c as object);
          return keys.length === 1 && keys[0] === "fingerprintHash";
        },
      );
      expect(hasStandaloneFingerprint).toBe(false);
    });

    it("IP 辅助条件带 OR [email, fingerprint]", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      mockSuccessfulFreeTransaction();

      await POST(makeRequest({ ...BASE_BODY, fingerprintHash: "fp-abc" }));

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const ownerOR: object[] = (call.where!.AND as any)[1].OR;
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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      expect((call.where as any).amount).toEqual({ equals: 0 });
    });

    it("收费商品 → WHERE 不含 amount 过滤", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makePaidAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);
      // paid 流程需要 transaction mock
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      expect((call.where as any).amount).toBeUndefined();
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
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
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
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
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
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: Function) => {
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
    it("免费商品被拦截 → 错误含「已领取过该商品」", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
        orderNo: "existing-uuid",
        email: "user@example.com",
      } as any);

      const res = await POST(makeRequest(BASE_BODY));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("已领取过该商品");
    });

    it("免费商品被拦截且有 expiresAt → 错误含「有效期至」时间信息", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      const expiresAt = new Date(Date.now() + 3600_000);
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt,
        orderNo: "existing-uuid",
        email: "user@example.com",
      } as any);

      const res = await POST(makeRequest(BASE_BODY));
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("有效期至");
    });

    it("收费商品被拦截 → 错误含「活跃订单」而非「已领取过」", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makePaidAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
        orderNo: "existing-uuid",
        email: "user@example.com",
      } as any);

      const res = await POST(
        makeRequest({ ...BASE_BODY, productId: "prod_paid" }),
      );
      const data = await res.json();

      expect(res.status).toBe(429);
      expect(data.error).toContain("活跃订单");
      expect(data.error).not.toContain("已领取过");
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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const timeOR = (call.where!.AND as any)[0].OR as object[];

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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!;
      const timeOR = (call.where!.AND as any)[0].OR as object[];

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

      const call = prismaMock.order.findFirst.mock.calls[0]![0]!
      const timeOR = (call.where!.AND as any)[0].OR as object[]
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

  // ─── 429 响应中 orderNo 的安全性 ──────────────────────────────────────────

  describe("429 响应 orderNo 安全性", () => {
    it("邮箱命中自己的活跃订单 → 429 响应包含 orderNo 供用户找回订单", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct())
      prismaMock.order.findFirst.mockResolvedValue({
        id: "existing",
        expiresAt: null,
        orderNo: "own-order-uuid",
        email: "user@example.com", // 与请求邮箱一致
      } as any)

      const res = await POST(makeRequest(BASE_BODY)) // BASE_BODY.email = "user@example.com"
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBe("own-order-uuid")
    })

    it("指纹命中他人订单（邮箱不同）→ 429 响应不含 orderNo，避免泄露他人订单号", async () => {
      prismaMock.product.findUnique.mockResolvedValue(makeFreeAutoFetchProduct())
      prismaMock.order.findFirst.mockResolvedValue({
        id: "other-user-order",
        expiresAt: null,
        orderNo: "other-user-order-uuid",
        email: "other@example.com", // 与请求邮箱不同
      } as any)

      const res = await POST(
        makeRequest({ ...BASE_BODY, fingerprintHash: "fp-shared-device" }),
      )
      const data = await res.json()

      expect(res.status).toBe(429)
      expect(data.orderNo).toBeUndefined()
    })
  })
});
