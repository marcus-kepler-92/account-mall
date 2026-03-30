/**
 * POST /api/admin/products/[productId]/blacklist/toggle
 * 覆盖：鉴权、请求体校验、商品查找、拉黑/解除拉黑逻辑
 */
import { NextRequest } from "next/server"
import { POST } from "@/app/api/admin/products/[productId]/blacklist/toggle/route"
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

import { getAdminSession } from "@/lib/auth-guard"

const getAdminSessionMock = getAdminSession as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
    } as unknown as NextRequest
}

function makeBadJsonRequest(): NextRequest {
    return {
        json: async () => { throw new Error("bad json") },
    } as unknown as NextRequest
}

function makeContext(productId = "prod_1") {
    return { params: Promise.resolve({ productId }) }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/admin/products/[productId]/blacklist/toggle", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getAdminSessionMock.mockResolvedValue({ user: { id: "admin_1" } })
        prismaMock.product.findUnique.mockResolvedValue({ id: "prod_1" } as never)
        prismaMock.accountBlacklist.findUnique.mockResolvedValue(null)
        prismaMock.accountBlacklist.create.mockResolvedValue({} as never)
        prismaMock.accountBlacklist.delete.mockResolvedValue({} as never)
    })

    // ─── 鉴权 ─────────────────────────────────────────────────────────────────

    describe("鉴权", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await POST(makeRequest({ account: "a@apple.com" }), makeContext())
            expect(res.status).toBe(401)
        })
    })

    // ─── 请求体校验 ───────────────────────────────────────────────────────────

    describe("请求体校验", () => {
        it("JSON 解析失败 → 400", async () => {
            const res = await POST(makeBadJsonRequest(), makeContext())
            expect(res.status).toBe(400)
        })

        it("缺少 account 字段 → 400", async () => {
            const res = await POST(makeRequest({}), makeContext())
            expect(res.status).toBe(400)
        })

        it("account 为非字符串 → 400", async () => {
            const res = await POST(makeRequest({ account: 123 }), makeContext())
            expect(res.status).toBe(400)
        })
    })

    // ─── 商品查找 ─────────────────────────────────────────────────────────────

    describe("商品查找", () => {
        it("商品不存在 → 404", async () => {
            prismaMock.product.findUnique.mockResolvedValue(null)
            const res = await POST(makeRequest({ account: "a@apple.com" }), makeContext())
            expect(res.status).toBe(404)
        })
    })

    // ─── 拉黑 / 解除拉黑 ─────────────────────────────────────────────────────

    describe("拉黑逻辑", () => {
        it("账号未拉黑 → 创建黑名单记录，返回 isBlacklisted: true", async () => {
            prismaMock.accountBlacklist.findUnique.mockResolvedValue(null)

            const res = await POST(makeRequest({ account: "a@apple.com" }), makeContext())
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.isBlacklisted).toBe(true)

            expect(prismaMock.accountBlacklist.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        productId: "prod_1",
                        account: "a@apple.com",
                        reason: "管理员手动拉黑",
                    }),
                })
            )
            expect(prismaMock.accountBlacklist.delete).not.toHaveBeenCalled()
        })

        it("账号已拉黑 → 删除黑名单记录，返回 isBlacklisted: false", async () => {
            prismaMock.accountBlacklist.findUnique.mockResolvedValue(
                { id: "bl_1", productId: "prod_1", account: "a@apple.com" } as never
            )

            const res = await POST(makeRequest({ account: "a@apple.com" }), makeContext())
            expect(res.status).toBe(200)
            const data = await res.json()
            expect(data.isBlacklisted).toBe(false)

            expect(prismaMock.accountBlacklist.delete).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: "bl_1" } })
            )
            expect(prismaMock.accountBlacklist.create).not.toHaveBeenCalled()
        })

        it("使用正确的复合唯一键 productId_account 查找", async () => {
            await POST(makeRequest({ account: "a@apple.com" }), makeContext("prod_99"))

            expect(prismaMock.accountBlacklist.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { productId_account: { productId: "prod_99", account: "a@apple.com" } },
                })
            )
        })
    })
})
