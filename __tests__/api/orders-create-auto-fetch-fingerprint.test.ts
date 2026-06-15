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
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
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
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    purchaseLimitEnabled: false,
    purchaseLimitQuantity: 1,
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
  (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
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


  // ─── fingerprintHash 存储 ─────────────────────────────────────────────────

  describe("fingerprintHash 写入订单", () => {
    it("下单时有指纹 → fingerprintHash 存入 order.create data", async () => {
      prismaMock.product.findUnique.mockResolvedValue(
        makeFreeAutoFetchProduct(),
      );
      prismaMock.order.findFirst.mockResolvedValue(null);

      let capturedOrderData: Record<string, unknown> | undefined;
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
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
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
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
      (prismaMock.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) => {
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
