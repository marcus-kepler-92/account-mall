import { closeExpiredOrders } from "@/lib/close-expired-orders"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        pendingOrderTimeoutMs: 900_000, // 15 min
        nodeEnv: "test",
    },
}))

import { prismaMock } from "../../__mocks__/prisma"

function makeExpiredOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        product: { productType: "NORMAL" as const },
        ...overrides,
    }
}

describe("closeExpiredOrders", () => {
    beforeEach(() => {
        prismaMock.order.findMany.mockReset()
        prismaMock.$transaction.mockReset()
    })

    it("returns { closed: 0, total: 0 } when no expired orders", async () => {
        prismaMock.order.findMany.mockResolvedValue([])
        const result = await closeExpiredOrders()
        expect(result).toEqual({ closed: 0, total: 0 })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("NORMAL 订单过期 → 卡密状态 RESERVED→UNSOLD, orderId 清空", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_normal", product: { productType: "NORMAL" } }),
        ])

        const txOrderUpdate = jest.fn().mockResolvedValue({})
        const txCardUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
        const txCardDeleteMany = jest.fn().mockResolvedValue({ count: 0 })

        prismaMock.$transaction.mockImplementation(async (fn: Function) => {
            const tx = {
                order: { update: txOrderUpdate },
                card: { updateMany: txCardUpdateMany, deleteMany: txCardDeleteMany },
            }
            return fn(tx)
        })

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)
        expect(result.total).toBe(1)

        expect(txOrderUpdate).toHaveBeenCalledWith({
            where: { id: "ord_normal" },
            data: { status: "CLOSED" },
        })
        expect(txCardUpdateMany).toHaveBeenCalledWith({
            where: { orderId: "ord_normal", status: "RESERVED" },
            data: { status: "UNSOLD", orderId: null },
        })
        expect(txCardDeleteMany).not.toHaveBeenCalled()
    })

    it("AUTO_FETCH 订单过期 → 卡密被删除而非回库", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_auto", product: { productType: "AUTO_FETCH" } }),
        ])

        const txOrderUpdate = jest.fn().mockResolvedValue({})
        const txCardUpdateMany = jest.fn().mockResolvedValue({ count: 0 })
        const txCardDeleteMany = jest.fn().mockResolvedValue({ count: 1 })

        prismaMock.$transaction.mockImplementation(async (fn: Function) => {
            const tx = {
                order: { update: txOrderUpdate },
                card: { updateMany: txCardUpdateMany, deleteMany: txCardDeleteMany },
            }
            return fn(tx)
        })

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)

        expect(txCardDeleteMany).toHaveBeenCalledWith({
            where: { orderId: "ord_auto", status: "RESERVED" },
        })
        expect(txCardUpdateMany).not.toHaveBeenCalled()
    })

    it("混合过期 → NORMAL 回库 + AUTO_FETCH 删除，互不影响", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_normal", product: { productType: "NORMAL" } }),
            makeExpiredOrder({ id: "ord_auto", product: { productType: "AUTO_FETCH" } }),
        ])

        const calls: { updateMany: jest.Mock; deleteMany: jest.Mock }[] = []

        prismaMock.$transaction.mockImplementation(async (fn: Function) => {
            const updateMany = jest.fn().mockResolvedValue({ count: 1 })
            const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
            calls.push({ updateMany, deleteMany })
            const tx = {
                order: { update: jest.fn().mockResolvedValue({}) },
                card: { updateMany, deleteMany },
            }
            return fn(tx)
        })

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(2)
        expect(result.total).toBe(2)

        // First call: NORMAL → updateMany
        expect(calls[0].updateMany).toHaveBeenCalled()
        expect(calls[0].deleteMany).not.toHaveBeenCalled()

        // Second call: AUTO_FETCH → deleteMany
        expect(calls[1].deleteMany).toHaveBeenCalled()
        expect(calls[1].updateMany).not.toHaveBeenCalled()
    })

    it("事务失败时不计入 closed，但继续处理其他订单", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_fail", product: { productType: "NORMAL" } }),
            makeExpiredOrder({ id: "ord_ok", product: { productType: "NORMAL" } }),
        ])

        let callCount = 0
        prismaMock.$transaction.mockImplementation(async (fn: Function) => {
            callCount++
            if (callCount === 1) throw new Error("DB error")
            const tx = {
                order: { update: jest.fn().mockResolvedValue({}) },
                card: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
            }
            return fn(tx)
        })

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)
        expect(result.total).toBe(2)
    })
})
