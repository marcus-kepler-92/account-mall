/**
 * POST /api/orders/[orderId]/switch-account
 * 覆盖：请求校验、token 验证、类型/状态/有效期检查、换号次数限制、爬取、事务写入
 */
import { NextRequest } from "next/server"
import { POST } from "@/app/api/orders/[orderId]/switch-account/route"
import { prismaMock } from "../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-success-token", () => ({
    __esModule: true,
    verifyOrderSuccessToken: jest.fn().mockReturnValue(true),
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    scrapeSharedAccounts: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
    config: {
        autoFetchSourceUrls: ["https://source.example.com"],
        nodeEnv: "test",
    },
}))

import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"

const verifyOrderSuccessTokenMock = verifyOrderSuccessToken as jest.Mock
const scrapeSharedAccountsMock = scrapeSharedAccounts as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
        cookies: { get: () => undefined },
    } as unknown as NextRequest
}

function makeContext(orderNo = "order-1") {
    return { params: Promise.resolve({ orderId: orderNo }) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeOrder(overrides?: Record<string, unknown>): any {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "COMPLETED",
        expiresAt: null,
        switchAccountCount: 0,
        product: {
            id: "prod_1",
            productType: "AUTO_FETCH",
            sourceUrl: "https://source.example.com",
            validityHours: 24,
            allowAccountSwitch: true,
            accountSwitchLimit: 1,
        },
        cards: [
            {
                id: "card_1",
                content: JSON.stringify({ account: "old@apple.com", password: "OldPass!", region: "US" }),
            },
        ],
        ...overrides,
    }
}

const NEW_ACCOUNT = { account: "new@apple.com", password: "NewPass!", region: "JP", status: "valid" }
const BODY = { token: "valid-token" }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/orders/[orderId]/switch-account", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        verifyOrderSuccessTokenMock.mockReturnValue(true)
        scrapeSharedAccountsMock.mockResolvedValue([NEW_ACCOUNT])
        prismaMock.accountBlacklist.findMany.mockResolvedValue([])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(prismaMock.$transaction as any).mockImplementation(async (ops: any[]) => Promise.all(ops))
        prismaMock.accountBlacklist.upsert.mockResolvedValue({} as never)
        prismaMock.card.update.mockResolvedValue({} as never)
        prismaMock.order.update.mockResolvedValue({} as never)
    })

    // ─── 请求校验 ─────────────────────────────────────────────────────────────

    describe("请求校验", () => {
        it("缺少 token → 400", async () => {
            const res = await POST(makeRequest({}), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("访问令牌")
        })

        it("JSON 解析失败 → 400", async () => {
            const req = { json: async () => { throw new Error("bad json") } } as unknown as NextRequest
            const res = await POST(req, makeContext())
            expect(res.status).toBe(400)
        })

        it("令牌无效 → 400", async () => {
            verifyOrderSuccessTokenMock.mockReturnValue(false)
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("令牌")
        })
    })

    // ─── 订单查找 & 类型检查 ──────────────────────────────────────────────────

    describe("订单查找 & 类型检查", () => {
        it("订单不存在 → 404", async () => {
            prismaMock.order.findUnique.mockResolvedValue(null)
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(404)
        })

        it("非 AUTO_FETCH → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ product: { id: "p1", productType: "NORMAL", sourceUrl: null, validityHours: null, allowAccountSwitch: true, accountSwitchLimit: 1 } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("AUTO_FETCH")
        })

        it("allowAccountSwitch=false → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ product: { id: "p1", productType: "AUTO_FETCH", sourceUrl: "https://s.com", validityHours: null, allowAccountSwitch: false, accountSwitchLimit: 1 } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未启用")
        })

        it("订单状态非 COMPLETED → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder({ status: "PENDING" }))
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未完成")
        })

        it("订单已过期 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ expiresAt: new Date(Date.now() - 1000) })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("已过期")
        })
    })

    // ─── 换号次数限制 ─────────────────────────────────────────────────────────

    describe("换号次数限制", () => {
        it("已达上限（limit=1）→ 400，文案含「只能切换一次」", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ switchAccountCount: 1, product: { id: "p1", productType: "AUTO_FETCH", sourceUrl: "https://s.com", validityHours: null, allowAccountSwitch: true, accountSwitchLimit: 1 } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("只能切换账号一次")
        })

        it("已达上限（limit=3）→ 400，文案含次数", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ switchAccountCount: 3, product: { id: "p1", productType: "AUTO_FETCH", sourceUrl: "https://s.com", validityHours: null, allowAccountSwitch: true, accountSwitchLimit: 3 } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("3")
        })

        it("未达上限（count=1, limit=3）→ 允许换号", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ switchAccountCount: 1, product: { id: "p1", productType: "AUTO_FETCH", sourceUrl: "https://s.com", validityHours: null, allowAccountSwitch: true, accountSwitchLimit: 3 } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(200)
        })
    })

    // ─── 卡密 & sourceUrl ─────────────────────────────────────────────────────

    describe("卡密 & sourceUrl", () => {
        it("无 SOLD 卡密 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder({ cards: [] }))
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未找到")
        })

        it("sourceUrl 未配置 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ product: { id: "p1", productType: "AUTO_FETCH", sourceUrl: null, validityHours: null, allowAccountSwitch: true, accountSwitchLimit: 1 } })
            )
            const { config } = require("@/lib/config")
            const original = config.autoFetchSourceUrls
            config.autoFetchSourceUrls = []

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未配置爬取来源")

            config.autoFetchSourceUrls = original
        })
    })

    // ─── 爬取结果 ─────────────────────────────────────────────────────────────

    describe("爬取结果处理", () => {
        it("爬取返回空列表 → 503", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())
            scrapeSharedAccountsMock.mockResolvedValue([])

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(503)
        })

        it("所有账号被黑名单过滤（含当前账号）→ 503", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())
            // 爬取到的唯一账号就是当前账号 old@apple.com，会被 currentAccount 过滤
            scrapeSharedAccountsMock.mockResolvedValue([
                { account: "old@apple.com", password: "p", region: "US", status: "valid" },
            ])

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(503)
        })

        it("爬取成功 → 200，switched: true，payload 含新账号", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())

            const res = await POST(makeRequest(BODY), makeContext())
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.switched).toBe(true)
            expect(data.payload.account).toBe("new@apple.com")
        })
    })

    // ─── 事务写入 ─────────────────────────────────────────────────────────────

    describe("事务写入", () => {
        it("旧账号加入黑名单", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())

            await POST(makeRequest(BODY), makeContext())

            expect(prismaMock.accountBlacklist.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    create: expect.objectContaining({ account: "old@apple.com", reason: "用户标记不可用" }),
                })
            )
        })

        it("card.update 写入新内容", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())

            await POST(makeRequest(BODY), makeContext())

            expect(prismaMock.card.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "card_1" },
                    data: expect.objectContaining({
                        content: expect.stringContaining("new@apple.com"),
                        lastRefreshedAt: expect.any(Date),
                    }),
                })
            )
        })

        it("order.update 递增 switchAccountCount", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeOrder())

            await POST(makeRequest(BODY), makeContext())

            expect(prismaMock.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "ord_1" },
                    data: { switchAccountCount: { increment: 1 } },
                })
            )
        })

        it("当前账号为空时不写黑名单", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeOrder({ cards: [{ id: "card_1", content: "{}" }] })
            )

            await POST(makeRequest(BODY), makeContext())

            expect(prismaMock.accountBlacklist.upsert).not.toHaveBeenCalled()
        })
    })
})
