import { closeExpiredOrders } from "@/lib/close-expired-orders"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        pendingOrderTimeoutMs: 900_000, // 15 min
        zpayReconcileBackstopMs: 86_400_000, // 24h
        nodeEnv: "test",
    },
}))

jest.mock("@/lib/zpay", () => ({ queryZpayOrder: jest.fn() }))
jest.mock("@/lib/complete-pending-order", () => ({ completePendingOrder: jest.fn() }))

import { prismaMock } from "../../__mocks__/prisma"
import { queryZpayOrder } from "@/lib/zpay"
import { completePendingOrder } from "@/lib/complete-pending-order"

const queryZpayMock = queryZpayOrder as jest.Mock
const completeMock = completePendingOrder as jest.Mock

function makeExpiredOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        orderNo: "no_1",
        // Recent enough to be within the reconcile backstop by default.
        createdAt: new Date("2026-06-24T00:00:00Z"),
        product: { productType: "NORMAL" as const },
        ...overrides,
    }
}

describe("closeExpiredOrders", () => {
    beforeEach(() => {
        prismaMock.order.findMany.mockReset()
        prismaMock.$transaction.mockReset()
        queryZpayMock.mockReset()
        completeMock.mockReset()
        // Default: gateway positively confirms the order is unpaid → eligible to close.
        queryZpayMock.mockResolvedValue({ status: "unpaid" })
    })

    it("returns zeroed result when no expired orders", async () => {
        prismaMock.order.findMany.mockResolvedValue([] as any)
        const result = await closeExpiredOrders()
        expect(result).toEqual({ closed: 0, recovered: 0, deferred: 0, total: 0, failedOrderNos: [] })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("NORMAL 订单确认未付 → 卡密状态 RESERVED→UNSOLD, orderId 清空", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_normal", product: { productType: "NORMAL" } }),
        ] as any)

        const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
        const txCardUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
        const txCardDeleteMany = jest.fn().mockResolvedValue({ count: 0 })

        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            const tx = {
                order: { updateMany: txOrderUpdateMany },
                card: { updateMany: txCardUpdateMany, deleteMany: txCardDeleteMany },
            }
            return fn(tx)
        }) as any)

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)
        expect(result.total).toBe(1)

        expect(txOrderUpdateMany).toHaveBeenCalledWith({
            where: { id: "ord_normal", status: "PENDING" },
            data: { status: "CLOSED" },
        })
        expect(txCardUpdateMany).toHaveBeenCalledWith({
            where: { orderId: "ord_normal", status: "RESERVED" },
            data: { status: "UNSOLD", orderId: null },
        })
        expect(txCardDeleteMany).not.toHaveBeenCalled()
    })

    it("AUTO_FETCH 订单确认未付 → 卡密被删除而非回库", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_auto", product: { productType: "AUTO_FETCH" } }),
        ] as any)

        const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
        const txCardUpdateMany = jest.fn().mockResolvedValue({ count: 0 })
        const txCardDeleteMany = jest.fn().mockResolvedValue({ count: 1 })

        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            const tx = {
                order: { updateMany: txOrderUpdateMany },
                card: { updateMany: txCardUpdateMany, deleteMany: txCardDeleteMany },
            }
            return fn(tx)
        }) as any)

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)

        expect(txCardDeleteMany).toHaveBeenCalledWith({
            where: { orderId: "ord_auto", status: "RESERVED" },
        })
        expect(txCardUpdateMany).not.toHaveBeenCalled()
    })

    it("not_found(网关无此单)→ 同样关闭", async () => {
        queryZpayMock.mockResolvedValue({ status: "not_found" })
        prismaMock.order.findMany.mockResolvedValue([makeExpiredOrder()] as any)

        const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            return fn({
                order: { updateMany: txOrderUpdateMany },
                card: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
            })
        }) as any)

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)
        expect(result.deferred).toBe(0)
        expect(txOrderUpdateMany).toHaveBeenCalled()
    })

    it("paid(网关确认已付,notify 丢了)→ 救回完成,不关单", async () => {
        queryZpayMock.mockResolvedValue({ status: "paid" })
        completeMock.mockResolvedValue({})
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ orderNo: "no_paid" }),
        ] as any)

        const result = await closeExpiredOrders()
        expect(result.recovered).toBe(1)
        expect(result.closed).toBe(0)
        expect(completeMock).toHaveBeenCalledWith("no_paid")
        // Never opened a close transaction.
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
    })

    it("paid 但 completePendingOrder 抛错 → 计入 failedOrderNos,不关单,留待重试", async () => {
        queryZpayMock.mockResolvedValue({ status: "paid" })
        completeMock.mockRejectedValue(new Error("DB error"))
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ orderNo: "no_paid_fail" }),
        ] as any)

        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
        const result = await closeExpiredOrders()

        expect(result.recovered).toBe(0)
        expect(result.closed).toBe(0)
        expect(result.failedOrderNos).toEqual(["no_paid_fail"])
        // Must never fall through to the close transaction for a paid order.
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        errorSpy.mockRestore()
    })

    it("error(查单失败)且未超 backstop → 延迟,不关不救", async () => {
        queryZpayMock.mockResolvedValue({ status: "error" })
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ createdAt: new Date("2026-06-24T00:00:00Z") }),
        ] as any)

        const result = await closeExpiredOrders()
        expect(result.deferred).toBe(1)
        expect(result.closed).toBe(0)
        expect(result.recovered).toBe(0)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(completeMock).not.toHaveBeenCalled()
    })

    it("error 且超 backstop → 升级告警,仍不自动关", async () => {
        queryZpayMock.mockResolvedValue({ status: "error" })
        // createdAt far in the past → age > 24h backstop relative to a 2026 "now".
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ orderNo: "no_stuck", createdAt: new Date("2020-01-01T00:00:00Z") }),
        ] as any)

        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
        const result = await closeExpiredOrders()

        expect(result.deferred).toBe(1)
        expect(result.closed).toBe(0)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("decision=escalate"),
            "no_stuck",
            expect.any(Number),
        )
        errorSpy.mockRestore()
    })

    it("并发付款已完成 → 守卫 updateMany count=0，不覆盖订单、不动卡密、不计入 closed", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_paid", orderNo: "no_paid", product: { productType: "NORMAL" } }),
        ] as any)

        // Gateway query is slightly stale (says unpaid), but the order was already
        // completed by a concurrent notify, so the status-guarded updateMany hits 0 rows.
        const txOrderUpdateMany = jest.fn().mockResolvedValue({ count: 0 })
        const txCardUpdateMany = jest.fn().mockResolvedValue({ count: 0 })
        const txCardDeleteMany = jest.fn().mockResolvedValue({ count: 0 })

        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            const tx = {
                order: { updateMany: txOrderUpdateMany },
                card: { updateMany: txCardUpdateMany, deleteMany: txCardDeleteMany },
            }
            return fn(tx)
        }) as any)

        const result = await closeExpiredOrders()

        expect(txOrderUpdateMany).toHaveBeenCalledWith({
            where: { id: "ord_paid", status: "PENDING" },
            data: { status: "CLOSED" },
        })
        expect(txCardUpdateMany).not.toHaveBeenCalled()
        expect(txCardDeleteMany).not.toHaveBeenCalled()
        expect(result.closed).toBe(0)
        expect(result.total).toBe(1)
    })

    it("混合：未付 NORMAL 回库 + 未付 AUTO_FETCH 删除，互不影响", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_normal", orderNo: "no_n", product: { productType: "NORMAL" } }),
            makeExpiredOrder({ id: "ord_auto", orderNo: "no_a", product: { productType: "AUTO_FETCH" } }),
        ] as any)

        const calls: { updateMany: jest.Mock; deleteMany: jest.Mock }[] = []

        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            const updateMany = jest.fn().mockResolvedValue({ count: 1 })
            const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
            calls.push({ updateMany, deleteMany })
            const tx = {
                order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
                card: { updateMany, deleteMany },
            }
            return fn(tx)
        }) as any)

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(2)
        expect(result.total).toBe(2)

        expect(calls[0].updateMany).toHaveBeenCalled()
        expect(calls[0].deleteMany).not.toHaveBeenCalled()
        expect(calls[1].deleteMany).toHaveBeenCalled()
        expect(calls[1].updateMany).not.toHaveBeenCalled()
    })

    it("事务失败时不计入 closed，但继续处理其他订单", async () => {
        prismaMock.order.findMany.mockResolvedValue([
            makeExpiredOrder({ id: "ord_fail", orderNo: "no_f", product: { productType: "NORMAL" } }),
            makeExpiredOrder({ id: "ord_ok", orderNo: "no_ok", product: { productType: "NORMAL" } }),
        ] as any)

        let callCount = 0
        prismaMock.$transaction.mockImplementation((async (fn: (tx: unknown) => unknown) => {
            callCount++
            if (callCount === 1) throw new Error("DB error")
            const tx = {
                order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
                card: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
            }
            return fn(tx)
        }) as any)

        const result = await closeExpiredOrders()
        expect(result.closed).toBe(1)
        expect(result.total).toBe(2)
        expect(result.failedOrderNos).toEqual(["no_f"])
    })
})
