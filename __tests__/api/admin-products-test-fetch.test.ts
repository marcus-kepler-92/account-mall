/**
 * POST /api/admin/products/[productId]/test-fetch
 * 覆盖：鉴权、商品查找、productType 检查、sourceUrl 配置、爬取结果、黑名单合并
 */
import { NextRequest } from "next/server"
import { POST } from "@/app/api/admin/products/[productId]/test-fetch/route"
import { prismaMock } from "../../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

jest.mock("@/lib/scrape-shared-accounts", () => ({
    scrapeMultipleUrls: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
    config: {
        autoFetchSourceUrls: ["https://fallback-source.example.com"],
    },
}))

import { getAdminSession } from "@/lib/auth-guard"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"

const getAdminSessionMock = getAdminSession as jest.Mock
const scrapeMultipleUrlsMock = scrapeMultipleUrls as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REQ = {} as NextRequest

function makeContext(productId = "prod_1") {
    return { params: Promise.resolve({ productId }) }
}

 
function makeProduct(overrides?: Record<string, unknown>): any {
    return {
        id: "prod_1",
        productType: "AUTO_FETCH",
        sourceUrl: "https://source.example.com",
        ...overrides,
    }
}

const SCRAPED = [
    { account: "a@apple.com", password: "pass1", region: "US" },
    { account: "b@apple.com", password: "pass2", region: "JP" },
    { account: "c@apple.com", password: "pass3", region: "CN" },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/admin/products/[productId]/test-fetch", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getAdminSessionMock.mockResolvedValue({ user: { id: "admin_1" } })
        scrapeMultipleUrlsMock.mockResolvedValue(SCRAPED)
        prismaMock.accountBlacklist.findMany.mockResolvedValue([])
    })

    // ─── 鉴权 ─────────────────────────────────────────────────────────────────

    describe("鉴权", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(401)
        })
    })

    // ─── 商品查找 & 类型校验 ──────────────────────────────────────────────────

    describe("商品查找 & 类型校验", () => {
        it("商品不存在 → 404", async () => {
            prismaMock.product.findUnique.mockResolvedValue(null)
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(404)
        })

        it("非 AUTO_FETCH 商品 → 400", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct({ productType: "NORMAL" }))
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("AUTO_FETCH")
        })
    })

    // ─── sourceUrl 配置 ───────────────────────────────────────────────────────

    describe("sourceUrl 配置", () => {
        it("sourceUrl 未配置且 fallback 为空 → 400", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct({ sourceUrl: null }))
            const { config } = require("@/lib/config")
            const original = config.autoFetchSourceUrls
            config.autoFetchSourceUrls = []

            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(400)
            const data = await res.json()
            expect(data.error).toContain("未配置爬取来源")

            config.autoFetchSourceUrls = original
        })

        it("sourceUrl 为空时使用 fallback URL", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct({ sourceUrl: null }))
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(200)
            expect(scrapeMultipleUrlsMock).toHaveBeenCalledWith("https://fallback-source.example.com")
        })

        it("使用商品自身 sourceUrl", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(200)
            expect(scrapeMultipleUrlsMock).toHaveBeenCalledWith("https://source.example.com")
        })
    })

    // ─── 爬取结果 ─────────────────────────────────────────────────────────────

    describe("爬取结果", () => {
        it("爬取返回空列表 → 503", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            scrapeMultipleUrlsMock.mockResolvedValue([])
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(503)
        })

        it("正常爬取 → 200，返回 accounts 列表", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            const res = await POST(REQ, makeContext())
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.total).toBe(3)
            expect(data.accounts).toHaveLength(3)
            expect(data.sourceUrl).toBe("https://source.example.com")
        })
    })

    // ─── 黑名单合并 ───────────────────────────────────────────────────────────

    describe("黑名单合并", () => {
        it("未拉黑账号 isBlacklisted=false", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            const res = await POST(REQ, makeContext())
            const data = await res.json()
            expect(data.accounts.every((a: { isBlacklisted: boolean }) => !a.isBlacklisted)).toBe(true)
            expect(data.availableCount).toBe(3)
            expect(data.blacklistedCount).toBe(0)
        })

        it("部分账号拉黑后，isBlacklisted 正确标记", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            prismaMock.accountBlacklist.findMany.mockResolvedValue([
                { account: "a@apple.com" } as never,
            ])
            const res = await POST(REQ, makeContext())
            const data = await res.json()
            const blacklisted = data.accounts.filter((a: { isBlacklisted: boolean }) => a.isBlacklisted)
            const available = data.accounts.filter((a: { isBlacklisted: boolean }) => !a.isBlacklisted)
            expect(blacklisted).toHaveLength(1)
            expect(blacklisted[0].account).toBe("a@apple.com")
            expect(available).toHaveLength(2)
            expect(data.availableCount).toBe(2)
            expect(data.blacklistedCount).toBe(1)
        })

        it("全部账号拉黑时，availableCount=0", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            prismaMock.accountBlacklist.findMany.mockResolvedValue(
                SCRAPED.map((a) => ({ account: a.account }) as never)
            )
            const res = await POST(REQ, makeContext())
            const data = await res.json()
            expect(data.availableCount).toBe(0)
            expect(data.blacklistedCount).toBe(3)
        })

        it("accounts 含 region 字段（空时为空字符串）", async () => {
            prismaMock.product.findUnique.mockResolvedValue(makeProduct())
            scrapeMultipleUrlsMock.mockResolvedValue([
                { account: "x@apple.com", password: "p", region: undefined },
            ])
            const res = await POST(REQ, makeContext())
            const data = await res.json()
            expect(data.accounts[0].region).toBe("")
        })
    })
})
