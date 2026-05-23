/**
 * Admin variants CRUD API
 * GET   /api/admin/products/[productId]/variants
 * POST  /api/admin/products/[productId]/variants
 * PATCH /api/admin/products/[productId]/variants/[variantId]
 * DELETE /api/admin/products/[productId]/variants/[variantId]
 */
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import {
    GET as listVariantsHandler,
    POST as createVariantHandler,
} from "@/app/api/admin/products/[productId]/variants/route"
import {
    PATCH as updateVariantHandler,
    DELETE as deleteVariantHandler,
} from "@/app/api/admin/products/[productId]/variants/[variantId]/route"
import { prismaMock } from "../__mocks__/prisma"

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getAdminSession: jest.fn(),
}))

import { getAdminSession } from "@/lib/auth-guard"

const getAdminSessionMock = getAdminSession as jest.Mock

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown): NextRequest {
    return {
        json: async () => {
            if (body === undefined) throw new Error("no body")
            return body
        },
    } as unknown as NextRequest
}

function listCtx(productId = "prod_manual_1") {
    return { params: Promise.resolve({ productId }) }
}

function itemCtx(productId = "prod_manual_1", variantId = "var_1") {
    return { params: Promise.resolve({ productId, variantId }) }
}

function makeVariant(overrides: Partial<{
    id: string
    productId: string
    name: string
    price: number
    unitCost: number | null
    stockQuantity: number
    sortOrder: number
    isActive: boolean
}> = {}) {
    const base = {
        id: "var_1",
        productId: "prod_manual_1",
        name: "1 个月",
        price: new Prisma.Decimal("29.90"),
        unitCost: new Prisma.Decimal("10.00"),
        stockQuantity: 50,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
    }
    return {
        ...base,
        ...overrides,
        price:
            overrides.price !== undefined
                ? new Prisma.Decimal(overrides.price)
                : base.price,
        unitCost:
            overrides.unitCost === null
                ? null
                : overrides.unitCost !== undefined
                    ? new Prisma.Decimal(overrides.unitCost)
                    : base.unitCost,
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Admin variants API", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        getAdminSessionMock.mockResolvedValue({ user: { id: "admin_1" } })
    })

    // ─── GET list ────────────────────────────────────────────────────────────

    describe("GET /api/admin/products/[productId]/variants", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await listVariantsHandler(makeRequest(), listCtx())
            expect(res.status).toBe(401)
        })

        it("已登录 → 返回 SKU 列表", async () => {
            prismaMock.productVariant.findMany.mockResolvedValue([
                makeVariant({ id: "var_a", name: "1 个月", price: 29.9 }),
                makeVariant({ id: "var_b", name: "3 个月", price: 79.0, sortOrder: 1 }),
            ] as never)

            const res = await listVariantsHandler(makeRequest(), listCtx())
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.variants).toHaveLength(2)
            expect(body.variants[0]).toMatchObject({
                id: "var_a",
                name: "1 个月",
                price: "29.9",
            })
            expect(body.variants[1].name).toBe("3 个月")
        })
    })

    // ─── POST create ─────────────────────────────────────────────────────────

    describe("POST /api/admin/products/[productId]/variants", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await createVariantHandler(
                makeRequest({ name: "x", price: 1, stockQuantity: 1 }),
                listCtx(),
            )
            expect(res.status).toBe(401)
        })

        it("非 JSON body → 400", async () => {
            const res = await createVariantHandler(makeRequest(), listCtx())
            expect(res.status).toBe(400)
        })

        it("缺少必填字段 → 400 (validation)", async () => {
            const res = await createVariantHandler(
                makeRequest({ name: "" }),
                listCtx(),
            )
            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.code).toBe("VALIDATION_FAILED")
        })

        it("非 MANUAL 商品 → 400", async () => {
            prismaMock.product.findUnique.mockResolvedValue({
                productType: "NORMAL",
            } as never)

            const res = await createVariantHandler(
                makeRequest({
                    name: "1 个月",
                    price: 29.9,
                    stockQuantity: 50,
                }),
                listCtx(),
            )
            expect(res.status).toBe(400)
        })

        it("MANUAL 商品 → 创建成功并返回新 SKU", async () => {
            prismaMock.product.findUnique.mockResolvedValue({
                productType: "MANUAL",
            } as never)
            prismaMock.productVariant.create.mockResolvedValue(
                makeVariant({ id: "var_new", name: "1 个月", price: 29.9 }) as never,
            )

            const res = await createVariantHandler(
                makeRequest({
                    name: "1 个月",
                    price: 29.9,
                    stockQuantity: 50,
                    unitCost: 10.0,
                    sortOrder: 0,
                    isActive: true,
                }),
                listCtx(),
            )
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body).toMatchObject({
                id: "var_new",
                name: "1 个月",
                price: "29.9",
                stockQuantity: 50,
                isActive: true,
            })
            expect(prismaMock.productVariant.create).toHaveBeenCalled()
        })
    })

    // ─── PATCH update ────────────────────────────────────────────────────────

    describe("PATCH /api/admin/products/[productId]/variants/[variantId]", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await updateVariantHandler(
                makeRequest({ isActive: false }),
                itemCtx(),
            )
            expect(res.status).toBe(401)
        })

        it("变体不存在 → 404", async () => {
            prismaMock.productVariant.findUnique.mockResolvedValue(null)
            const res = await updateVariantHandler(
                makeRequest({ isActive: false }),
                itemCtx(),
            )
            expect(res.status).toBe(404)
        })

        it("更新成功 → 返回 SKU；停用最后一个时商品自动下架", async () => {
            prismaMock.productVariant.findUnique.mockResolvedValue(
                makeVariant({ id: "var_1", isActive: true }) as never,
            )
            prismaMock.productVariant.update.mockResolvedValue(
                makeVariant({ id: "var_1", isActive: false }) as never,
            )
            // No remaining active variants after deactivating.
            prismaMock.productVariant.count.mockResolvedValue(0 as never)
            prismaMock.product.update.mockResolvedValue({} as never)

            const res = await updateVariantHandler(
                makeRequest({ isActive: false }),
                itemCtx(),
            )
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.id).toBe("var_1")
            expect(body.isActive).toBe(false)
            // Product should be auto-deactivated when last active variant is disabled.
            expect(prismaMock.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "prod_manual_1" },
                    data: { status: "INACTIVE" },
                }),
            )
        })
    })

    // ─── DELETE ──────────────────────────────────────────────────────────────

    describe("DELETE /api/admin/products/[productId]/variants/[variantId]", () => {
        it("未登录 → 401", async () => {
            getAdminSessionMock.mockResolvedValue(null)
            const res = await deleteVariantHandler(makeRequest(), itemCtx())
            expect(res.status).toBe(401)
        })

        it("变体不存在 → 404", async () => {
            prismaMock.productVariant.findUnique.mockResolvedValue(null)
            const res = await deleteVariantHandler(makeRequest(), itemCtx())
            expect(res.status).toBe(404)
        })

        it("有关联订单 → 409", async () => {
            prismaMock.productVariant.findUnique.mockResolvedValue(
                makeVariant({ id: "var_1" }) as never,
            )
            prismaMock.order.count.mockResolvedValue(3 as never)

            const res = await deleteVariantHandler(makeRequest(), itemCtx())
            expect(res.status).toBe(409)
        })

        it("无关联订单 → 删除成功", async () => {
            prismaMock.productVariant.findUnique.mockResolvedValue(
                makeVariant({ id: "var_1" }) as never,
            )
            prismaMock.order.count.mockResolvedValue(0 as never)
            prismaMock.productVariant.delete.mockResolvedValue({} as never)
            // After delete, suppose still 1 active variant remaining → no product change.
            prismaMock.productVariant.count.mockResolvedValue(1 as never)

            const res = await deleteVariantHandler(makeRequest(), itemCtx())
            expect(res.status).toBe(200)
            const body = await res.json()
            expect(body.ok).toBe(true)
            expect(prismaMock.productVariant.delete).toHaveBeenCalled()
        })
    })
})
