/**
 * POST /api/orders/[orderId]/refresh
 * 覆盖：订单校验、密码验证、类型检查、过期检查、限流、爬取、账号更新
 */
import { NextRequest } from "next/server"
import { POST } from "@/app/api/orders/[orderId]/refresh/route"
import { prismaMock } from "../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
    __esModule: true,
    verifyPassword: jest.fn().mockResolvedValue(true),
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    scrapeSharedAccounts: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
    config: {
        autoFetchSourceUrl: "https://source.example.com",
        nodeEnv: "test",
    },
}))

import { verifyPassword } from "better-auth/crypto"
import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"

const verifyPasswordMock = verifyPassword as jest.Mock
const scrapeSharedAccountsMock = scrapeSharedAccounts as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, orderNo = "order-1"): NextRequest {
    return {
        json: async () => body,
        cookies: { get: () => undefined },
    } as unknown as NextRequest
}

function makeContext(orderNo = "order-1") {
    return { params: Promise.resolve({ orderId: orderNo }) }
}

function makeCompletedAutoFetchOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "COMPLETED",
        passwordHash: "hashed-pw",
        expiresAt: null,
        product: {
            productType: "AUTO_FETCH",
            sourceUrl: "https://source.example.com",
            validityHours: 24,
        },
        cards: [
            {
                id: "card_1",
                content: JSON.stringify({ account: "user@apple.com", password: "OldPass!", region: "US" }),
                lastRefreshedAt: null,
            },
        ],
        ...overrides,
    }
}

const SCRAPED_ACCOUNT = {
    account: "user@apple.com",
    password: "NewPass!",
    region: "US",
    status: "valid",
}

const SCRAPED_ACCOUNT_NEW = {
    account: "other@apple.com",
    password: "OtherPass!",
    region: "JP",
    status: "valid",
}

const BODY = { password: "order-password" }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/orders/[orderId]/refresh", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        verifyPasswordMock.mockResolvedValue(true)
        scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT])
    })

    // ─── 请求校验 ─────────────────────────────────────────────────────────────

    describe("请求校验", () => {
        it("缺少 password → 400", async () => {
            const res = await POST(makeRequest({}), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("订单密码")
        })

        it("JSON 解析失败 → 400", async () => {
            const req = { json: async () => { throw new Error("bad json") } } as unknown as NextRequest
            const res = await POST(req, makeContext())
            expect(res.status).toBe(400)
        })
    })

    // ─── 订单查找 & 密码 ──────────────────────────────────────────────────────

    describe("订单查找 & 密码验证", () => {
        it("订单不存在 → 404", async () => {
            prismaMock.order.findUnique.mockResolvedValue(null)
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(404)
        })

        it("密码错误 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            verifyPasswordMock.mockResolvedValue(false)
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("密码错误")
        })
    })

    // ─── 类型 & 状态检查 ──────────────────────────────────────────────────────

    describe("类型 & 状态检查", () => {
        it("非 AUTO_FETCH 商品 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ product: { productType: "NORMAL", sourceUrl: null, validityHours: null } })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("不支持刷新")
        })

        it("订单状态非 COMPLETED → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ status: "PENDING" })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未完成")
        })
    })

    // ─── 过期检查 ─────────────────────────────────────────────────────────────

    describe("有效期检查", () => {
        it("expiresAt 已过期 → 400「订单已过期」", async () => {
            const expiredAt = new Date(Date.now() - 1000) // 1 秒前已过期
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ expiresAt: expiredAt })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("已过期")
            expect(data.error).toContain("重新下单")
        })

        it("expiresAt 未来时间 → 允许刷新", async () => {
            const futureAt = new Date(Date.now() + 3600_000) // 1 小时后
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ expiresAt: futureAt })
            )
            prismaMock.card.update.mockResolvedValue({})

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(200)
        })

        it("expiresAt 为 null（无有效期）→ 不拒绝", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ expiresAt: null })
            )
            prismaMock.card.update.mockResolvedValue({})

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(200)
        })

        it("expiresAt 恰好等于当前时间（边界）→ 400", async () => {
            // expiresAt <= new Date() 时拒绝
            const now = new Date()
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ expiresAt: now })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            // expiresAt <= new Date() 成立，应返回 400
            expect(res.status).toBe(400)
        })
    })

    // ─── 卡密 & 限流 ─────────────────────────────────────────────────────────

    describe("卡密 & 刷新限流", () => {
        it("无 SOLD 卡密 → 400", async () => {
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({ cards: [] })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未找到")
        })

        it("距上次刷新不足 1 分钟 → 429 含剩余秒数", async () => {
            const recentRefresh = new Date(Date.now() - 30_000) // 30 秒前
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({
                    cards: [{ id: "c1", content: "{}", lastRefreshedAt: recentRefresh }],
                })
            )
            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(429)
            const data = await res.json()
            expect(data.error).toMatch(/\d+\s*秒/)
        })

        it("距上次刷新超过 1 分钟 → 允许刷新", async () => {
            const oldRefresh = new Date(Date.now() - 70_000) // 70 秒前
            prismaMock.order.findUnique.mockResolvedValue(
                makeCompletedAutoFetchOrder({
                    cards: [{ id: "c1", content: JSON.stringify({ account: "user@apple.com" }), lastRefreshedAt: oldRefresh }],
                })
            )
            prismaMock.card.update.mockResolvedValue({})

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(200)
        })
    })

    // ─── sourceUrl ────────────────────────────────────────────────────────────

    describe("sourceUrl 配置", () => {
        it("product.sourceUrl 和全局配置均未设置 → 400", async () => {
            const order = makeCompletedAutoFetchOrder({
                product: { productType: "AUTO_FETCH", sourceUrl: null, validityHours: null },
            })
            prismaMock.order.findUnique.mockResolvedValue(order)
            // 覆盖全局配置
            const { config } = require("@/lib/config")
            const originalUrl = config.autoFetchSourceUrl
            config.autoFetchSourceUrl = ""

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未配置爬取来源")

            config.autoFetchSourceUrl = originalUrl
        })
    })

    // ─── 爬取结果 ─────────────────────────────────────────────────────────────

    describe("爬取结果处理", () => {
        it("爬取返回空列表 → 503，refreshed: false", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            scrapeSharedAccountsMock.mockResolvedValue([])

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(503)
            const data = await res.json()
            expect(data.refreshed).toBe(false)
            expect(data.error).toBeDefined()
        })

        it("爬取成功，原账号在列表中 → 更新密码，accountChanged: false", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT]) // 同账号，密码已变
            prismaMock.card.update.mockResolvedValue({})

            const res = await POST(makeRequest(BODY), makeContext())
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.refreshed).toBe(true)
            expect(data.accountChanged).toBe(false)
            expect(data.payload.account).toBe("user@apple.com")
            expect(data.payload.password).toBe("NewPass!")
            expect(data.refreshedAt).toBeDefined()
        })

        it("爬取成功，原账号不在列表中 → 换新账号，accountChanged: true", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT_NEW]) // 只有新账号
            prismaMock.card.update.mockResolvedValue({})

            const res = await POST(makeRequest(BODY), makeContext())
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.refreshed).toBe(true)
            expect(data.accountChanged).toBe(true)
            expect(data.payload.account).toBe("other@apple.com")
        })

        it("更新卡密时，写入新内容和 lastRefreshedAt", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT])

            let capturedUpdateData: Record<string, unknown> | undefined
            prismaMock.card.update.mockImplementation(async (args: { data: Record<string, unknown> }) => {
                capturedUpdateData = args.data
                return {}
            })

            await POST(makeRequest(BODY), makeContext())

            expect(capturedUpdateData?.lastRefreshedAt).toBeInstanceOf(Date)
            expect(typeof capturedUpdateData?.content).toBe("string")
            // content 应含 account 信息
            const parsed = JSON.parse(capturedUpdateData!.content as string)
            expect(parsed.account).toBe("user@apple.com")
        })

        it("card.update 失败 → 500", async () => {
            prismaMock.order.findUnique.mockResolvedValue(makeCompletedAutoFetchOrder())
            scrapeSharedAccountsMock.mockResolvedValue([SCRAPED_ACCOUNT])
            prismaMock.card.update.mockRejectedValue(new Error("DB error"))

            const res = await POST(makeRequest(BODY), makeContext())
            expect(res.status).toBe(500)
        })
    })
})
