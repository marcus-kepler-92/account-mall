import { completePendingOrder } from "@/lib/complete-pending-order"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/order-completion-email", () => ({
    sendOrderCompletionEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/config", () => ({
    getConfig: jest.fn(() => ({ invitationRewardAmount: 5 })),
}))

import { sendOrderCompletionEmail } from "@/lib/order-completion-email"
import { prismaMock } from "../../__mocks__/prisma"

const emailMock = sendOrderCompletionEmail as jest.Mock

function makePendingOrder(overrides?: Record<string, unknown>) {
    return {
        id: "ord_1",
        orderNo: "order-1",
        status: "PENDING",
        amount: 99,
        quantity: 1,
        distributorId: null as string | null,
        product: { name: "Test" },
        cards: [{ id: "c1", status: "RESERVED" }],
        ...overrides,
    } as any
}

describe("completePendingOrder", () => {
    beforeEach(() => {
        emailMock.mockClear()
        prismaMock.order.findFirst.mockReset()
        prismaMock.$transaction.mockReset()
        prismaMock.order.findMany.mockReset()
        prismaMock.commissionTier.findMany.mockReset()
        prismaMock.commission.create.mockReset()
        prismaMock.order.count?.mockReset()
        prismaMock.invitationReward?.findUnique?.mockReset()
        prismaMock.invitationReward?.create?.mockReset()
    })

    it("returns { done: false, error: 'Order not found' } when order does not exist", async () => {
        prismaMock.order.findFirst.mockResolvedValue(null)
        const result = await completePendingOrder("unknown")
        expect(result).toEqual({ done: false, error: "Order not found" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("returns { done: true, orderNo } when order is already COMPLETED", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "COMPLETED" }))
        const result = await completePendingOrder("order-1")
        expect(result).toEqual({ done: true, orderNo: "order-1" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("when order is already COMPLETED, commission.create is never called (idempotent, no duplicate commission)", async () => {
        prismaMock.order.findFirst.mockResolvedValue(
            makePendingOrder({ status: "COMPLETED", distributorId: "dist_1" })
        )
        await completePendingOrder("order-1")
        expect(prismaMock.commission.create).not.toHaveBeenCalled()
    })

    it("returns { done: false, error: 'Order is not pending' } when order is CLOSED", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ status: "CLOSED", cards: [] }))
        const result = await completePendingOrder("order-1")
        expect(result).toEqual({ done: false, error: "Order is not pending" })
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(emailMock).not.toHaveBeenCalled()
    })

    it("completes PENDING order: updates order and cards, sends email, returns { done: true, orderNo }", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
        prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
            await fn(prismaMock)
        })

        const result = await completePendingOrder("order-1")

        expect(result).toEqual({ done: true, orderNo: "order-1" })
        expect(prismaMock.order.updateMany).toHaveBeenCalledWith({
            where: { id: "ord_1", status: "PENDING" },
            data: { status: "COMPLETED", paidAt: expect.any(Date) },
        })
        expect(prismaMock.card.updateMany).toHaveBeenCalledWith({
            where: { orderId: "ord_1", status: "RESERVED" },
            data: { status: "SOLD" },
        })
        expect(emailMock).toHaveBeenCalledWith("ord_1")
    })

    it("throws when transaction fails", async () => {
        prismaMock.order.findFirst.mockResolvedValue(makePendingOrder())
        prismaMock.$transaction.mockRejectedValueOnce(new Error("DB_ERROR"))

        await expect(completePendingOrder("order-1")).rejects.toThrow("DB_ERROR")
        expect(emailMock).not.toHaveBeenCalled()
    })

    describe("commission (distributor)", () => {
        it("does not call commission.create when order has no distributorId", async () => {
            prismaMock.order.findFirst.mockResolvedValue(makePendingOrder({ distributorId: null }))
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("does not call commission.create when distributorId set but no tier matches", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 2,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 99 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("calls commission.create with tier bonus when week total falls in tier range", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    quantity: 1,
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 500 }, { amount: 200 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 1000, ratePercent: 5, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            // tier only: 100 * 5% = 5
            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 5,
                    status: "SETTLED",
                },
            })
        })

        it("rounds totalCommission to 2 decimal places", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 100 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 10.556, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            // 100 * 10.556% = 10.556 -> 10.56
            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    amount: 10.56,
                    status: "SETTLED",
                }),
            })
        })

        it("uses first tier rate when week total is below first tier min (e.g. 9 yuan order)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    amount: 9,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 9 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 400, maxAmount: 1200, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            // weekTotal=9 未落入 [400,1200)，按最低档 10%：9 * 10% = 0.9
            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 0.9,
                    status: "SETTLED",
                },
            })
        })

        it("calculates commission on original amount when discount was applied (paid 18, 10% off => original 20)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "other@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    amount: 18,
                    discountPercentApplied: 10,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 18 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 1000, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            // 佣金按原价：原价 = 18 / (1 - 0.1) = 20，20 * 10% = 2
            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 2,
                    status: "SETTLED",
                },
            })
        })

        it("does not create commission when order email equals distributor email (self-referral)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "buyer@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    email: "buyer@example.com",
                    quantity: 1,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([])
            prismaMock.commissionTier.findMany.mockResolvedValue([])
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).not.toHaveBeenCalled()
        })

        it("uses correct tier when weekTotal equals tier min (boundary inclusive)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 400 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 400, maxAmount: 1200, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).toHaveBeenCalledWith({
                data: {
                    orderId: "ord_1",
                    distributorId: "dist_1",
                    amount: 10,
                    status: "SETTLED",
                },
            })
        })

        it("commission amount is never negative or NaN", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "dist@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "dist_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 50 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 5, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.commission.create).toHaveBeenCalled()
            const call = (prismaMock.commission.create as jest.Mock).mock.calls[0][0]
            expect(call.data.amount).toBeGreaterThanOrEqual(0)
            expect(Number.isNaN(call.data.amount)).toBe(false)
        })
    })

    describe("invitation reward (invitee first order)", () => {
        it("creates InvitationReward when distributor has inviterId and this is their first COMPLETED order", async () => {
            prismaMock.user.findUnique
                .mockResolvedValueOnce({ email: "other@example.com" })
                .mockResolvedValueOnce({ inviterId: "inviter_1" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "invitee_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 100 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.order.count.mockResolvedValue(1)
            prismaMock.invitationReward.findUnique.mockResolvedValue(null)
            prismaMock.invitationReward.create.mockResolvedValue({})
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.invitationReward.create).toHaveBeenCalledTimes(1)
            expect(prismaMock.invitationReward.create).toHaveBeenCalledWith({
                data: {
                    inviterId: "inviter_1",
                    inviteeId: "invitee_1",
                    orderId: "ord_1",
                    amount: 5,
                    status: "SETTLED",
                },
            })
        })

        it("does not create InvitationReward when completedCount > 1 (not first order)", async () => {
            prismaMock.user.findUnique.mockResolvedValue({ email: "other@example.com" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "invitee_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 100 }, { amount: 50 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.order.count.mockResolvedValue(2)
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.invitationReward.create).not.toHaveBeenCalled()
        })

        it("does not create InvitationReward when distributor has no inviterId", async () => {
            prismaMock.user.findUnique
                .mockResolvedValueOnce({ email: "other@example.com" })
                .mockResolvedValueOnce({ inviterId: null })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "invitee_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 100 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.order.count.mockResolvedValue(1)
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.invitationReward.create).not.toHaveBeenCalled()
        })

        it("does not create InvitationReward when one already exists for this invitee", async () => {
            prismaMock.user.findUnique
                .mockResolvedValueOnce({ email: "other@example.com" })
                .mockResolvedValueOnce({ inviterId: "inviter_1" })
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({
                    distributorId: "invitee_1",
                    amount: 100,
                    product: { name: "Test" },
                })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.order.findMany.mockResolvedValue([{ amount: 100 }])
            prismaMock.commissionTier.findMany.mockResolvedValue([
                { minAmount: 0, maxAmount: 10000, ratePercent: 10, sortOrder: 0 },
            ])
            prismaMock.commission.create.mockResolvedValue({})
            prismaMock.order.count.mockResolvedValue(1)
            prismaMock.invitationReward.findUnique.mockResolvedValue({ id: "existing_1" } as any)
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            expect(prismaMock.invitationReward.create).not.toHaveBeenCalled()
        })
    })

    describe("AUTO_FETCH 付费订单 expiresAt", () => {
        function makeAutoFetchPendingOrder(overrides?: Record<string, unknown>) {
            return {
                id: "ord_af",
                orderNo: "af-order-1",
                status: "PENDING",
                amount: 19.9,
                quantity: 1,
                distributorId: null,
                expiresAt: null,
                exitDiscountMeta: null,
                product: { name: "AF Account", productType: "AUTO_FETCH", validityHours: 24 },
                cards: [{ id: "c_af", status: "RESERVED" }],
                ...overrides,
            } as any
        }

        function setupAutoFetchTransaction() {
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })
        }

        it("付费 AUTO_FETCH 完成支付 → expiresAt = paidAt + validityHours", async () => {
            prismaMock.order.findFirst.mockResolvedValue(makeAutoFetchPendingOrder())
            setupAutoFetchTransaction()

            const before = Date.now()
            await completePendingOrder("af-order-1")
            const after = Date.now()

            const updateCall = prismaMock.order.updateMany.mock.calls[0][0]
            const { expiresAt, paidAt } = updateCall.data
            expect(expiresAt).toBeInstanceOf(Date)
            // expiresAt 应 ≈ paidAt + 24h
            const expectedMs = 24 * 60 * 60 * 1000
            expect(expiresAt.getTime() - paidAt.getTime()).toBeCloseTo(expectedMs, -3)
            // paidAt 在测试前后之间
            expect(paidAt.getTime()).toBeGreaterThanOrEqual(before)
            expect(paidAt.getTime()).toBeLessThanOrEqual(after)
        })

        it("validityHours = 48 → expiresAt 为 48 小时后", async () => {
            prismaMock.order.findFirst.mockResolvedValue(
                makeAutoFetchPendingOrder({ product: { name: "AF", productType: "AUTO_FETCH", validityHours: 48 } })
            )
            setupAutoFetchTransaction()

            await completePendingOrder("af-order-1")

            const { expiresAt, paidAt } = prismaMock.order.updateMany.mock.calls[0][0].data
            const expectedMs = 48 * 60 * 60 * 1000
            expect(expiresAt.getTime() - paidAt.getTime()).toBeCloseTo(expectedMs, -3)
        })

        it("validityHours 未设置 → 默认 24 小时", async () => {
            prismaMock.order.findFirst.mockResolvedValue(
                makeAutoFetchPendingOrder({ product: { name: "AF", productType: "AUTO_FETCH", validityHours: null } })
            )
            setupAutoFetchTransaction()

            await completePendingOrder("af-order-1")

            const { expiresAt, paidAt } = prismaMock.order.updateMany.mock.calls[0][0].data
            const expectedMs = 24 * 60 * 60 * 1000
            expect(expiresAt.getTime() - paidAt.getTime()).toBeCloseTo(expectedMs, -3)
        })

        it("已有 expiresAt（幂等）→ 不覆盖，updateMany data 不含 expiresAt", async () => {
            const existingExpiresAt = new Date(Date.now() + 10 * 60 * 60 * 1000)
            prismaMock.order.findFirst.mockResolvedValue(
                makeAutoFetchPendingOrder({ expiresAt: existingExpiresAt })
            )
            setupAutoFetchTransaction()

            await completePendingOrder("af-order-1")

            const updateData = prismaMock.order.updateMany.mock.calls[0][0].data
            expect(updateData.expiresAt).toBeUndefined()
        })

        it("普通商品（NORMAL）→ updateMany data 不含 expiresAt", async () => {
            prismaMock.order.findFirst.mockResolvedValue(
                makePendingOrder({ product: { name: "Normal", productType: "NORMAL", validityHours: null } })
            )
            prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
            prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
                await fn(prismaMock)
            })

            await completePendingOrder("order-1")

            const updateData = prismaMock.order.updateMany.mock.calls[0][0].data
            expect(updateData.expiresAt).toBeUndefined()
        })
    })
})
