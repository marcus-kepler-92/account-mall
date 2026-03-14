import { prismaMock } from "../../__mocks__/prisma"
import {
    getDashboardKpis,
    getDashboardTrend,
    getOrderStatusDistribution,
    getTopProductsByRevenue,
    getInventoryByProduct,
    getRestockPending,
    getRecentOrders,
    getDashboardData,
} from "@/app/admin/(main)/dashboard/dashboard-data"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return {
        __esModule: true,
        prisma: prismaMock,
    }
})

const now = new Date("2024-02-14T12:00:00.000Z")
const startOfThisPeriod = new Date(now)
startOfThisPeriod.setDate(now.getDate() - 7)
startOfThisPeriod.setHours(0, 0, 0, 0)
const startOfLastPeriod = new Date(startOfThisPeriod)
startOfLastPeriod.setDate(startOfLastPeriod.getDate() - 7)

describe("dashboard-data", () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(now)
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    /** Provide all mock responses needed by getDashboardKpis' Promise.all (18 items) + 1 sequential query */
    function setupKpisMocks({
        totalRevenue = 1000,
        lastPeriodRevenue = 800,
        orderCount = 30,
        lastPeriodOrderCount = 10,
        thisPeriodOrderCount = 15,
        statusGroups = [
            { status: "COMPLETED", _count: { id: 20 } },
            { status: "PENDING", _count: { id: 5 } },
            { status: "CLOSED", _count: { id: 5 } },
        ],
        unsoldCardCount = 50,
        restockCount = 3,
        productCount = 5,
        distributorCount = 2,
        pendingWithdrawal = { _count: { id: 3 }, _sum: { amount: 1200 } },
        pendingCommission = { _sum: { amount: 150 } },
        settledCommission = { _sum: { amount: 200 } },
        paidFee = { _sum: { feeAmount: 10 } },
        lastPeriodCommission = { _sum: { amount: 180 } },
        lastPeriodFee = { _sum: { feeAmount: 8 } },
        thisPeriodCommission = { _sum: { amount: 160 } },
        thisPeriodFee = { _sum: { feeAmount: 5 } },
        thisPeriodRevenue = 600,
    } = {}) {
        // Promise.all order (18 queries):
        prismaMock.order.aggregate
            .mockResolvedValueOnce({ _sum: { amount: totalRevenue }, _count: { id: statusGroups.find(s => s.status === "COMPLETED")?._count.id ?? 20 } })
            .mockResolvedValueOnce({ _sum: { amount: lastPeriodRevenue } })
        prismaMock.order.count
            .mockResolvedValueOnce(orderCount)
            .mockResolvedValueOnce(lastPeriodOrderCount)
            .mockResolvedValueOnce(thisPeriodOrderCount)
        prismaMock.order.groupBy.mockResolvedValueOnce(statusGroups as any)
        prismaMock.card.count.mockResolvedValueOnce(unsoldCardCount)
        prismaMock.restockSubscription.count.mockResolvedValueOnce(restockCount)
        prismaMock.product.count.mockResolvedValueOnce(productCount)
        prismaMock.user.count.mockResolvedValueOnce(distributorCount)
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce(pendingWithdrawal)
            .mockResolvedValueOnce(paidFee)
            .mockResolvedValueOnce(lastPeriodFee)
            .mockResolvedValueOnce(thisPeriodFee)
        prismaMock.commission.aggregate
            .mockResolvedValueOnce(pendingCommission)
            .mockResolvedValueOnce(settledCommission)
            .mockResolvedValueOnce(lastPeriodCommission)
            .mockResolvedValueOnce(thisPeriodCommission)
        // Sequential: thisPeriodRevenue
        prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: thisPeriodRevenue } })
    }

    describe("getDashboardKpis", () => {
        it("returns kpis with correct shape and computed values", async () => {
            setupKpisMocks()

            const result = await getDashboardKpis()

            expect(result).toMatchObject({
                totalRevenue: 1000,
                orderCount: 30,
                completedCount: 20,
                pendingCount: 5,
                closedCount: 5,
                completionRate: (20 / 30) * 100,
                aov: 50,
                unsoldCardCount: 50,
                restockPendingCount: 3,
                activeProductCount: 5,
                distributorCount: 2,
                pendingWithdrawalCount: 3,
                pendingWithdrawalAmount: 1200,
                pendingCommissionAmount: 150,
            })
            expect(typeof result.revenueTrend).toBe("number")
            expect(typeof result.orderTrend).toBe("number")
        })

        it("returns correct netIncome, netMarginPercent, totalWithdrawalFee", async () => {
            // revenue=1000, commission=200, fee=10 → net=810, margin=81%
            setupKpisMocks({
                totalRevenue: 1000,
                settledCommission: { _sum: { amount: 200 } },
                paidFee: { _sum: { feeAmount: 10 } },
            })

            const result = await getDashboardKpis()

            expect(result.totalCommission).toBe(200)
            expect(result.totalWithdrawalFee).toBe(10)
            expect(result.netIncome).toBe(810)
            expect(result.netMarginPercent).toBeCloseTo(81, 1)
        })

        it("netMarginPercent is 0 when totalRevenue is 0 (no NaN)", async () => {
            setupKpisMocks({
                totalRevenue: 0,
                lastPeriodRevenue: 0,
                orderCount: 0,
                thisPeriodOrderCount: 0,
                lastPeriodOrderCount: 0,
                statusGroups: [],
                unsoldCardCount: 0,
                restockCount: 0,
                productCount: 0,
                distributorCount: 0,
                pendingWithdrawal: { _count: { id: 0 }, _sum: { amount: 0 } },
                pendingCommission: { _sum: { amount: 0 } },
                settledCommission: { _sum: { amount: 0 } },
                paidFee: { _sum: { feeAmount: null } },
                lastPeriodCommission: { _sum: { amount: 0 } },
                lastPeriodFee: { _sum: { feeAmount: null } },
                thisPeriodCommission: { _sum: { amount: 0 } },
                thisPeriodFee: { _sum: { feeAmount: null } },
                thisPeriodRevenue: 0,
            })

            const result = await getDashboardKpis()

            expect(result.netMarginPercent).toBe(0)
            expect(Number.isNaN(result.netMarginPercent)).toBe(false)
            expect(result.netIncome).toBe(0)
        })

        it("handles zero completed orders (AOV and completion rate)", async () => {
            setupKpisMocks({
                totalRevenue: 0,
                lastPeriodRevenue: 0,
                orderCount: 0,
                thisPeriodOrderCount: 0,
                lastPeriodOrderCount: 0,
                statusGroups: [],
                unsoldCardCount: 0,
                restockCount: 0,
                productCount: 0,
                distributorCount: 0,
                pendingWithdrawal: { _count: { id: 0 }, _sum: { amount: null } },
                pendingCommission: { _sum: { amount: null } },
                settledCommission: { _sum: { amount: null } },
                paidFee: { _sum: { feeAmount: null } },
                lastPeriodCommission: { _sum: { amount: null } },
                lastPeriodFee: { _sum: { feeAmount: null } },
                thisPeriodCommission: { _sum: { amount: null } },
                thisPeriodFee: { _sum: { feeAmount: null } },
                thisPeriodRevenue: 0,
            })

            const result = await getDashboardKpis()

            expect(result.aov).toBe(0)
            expect(result.completionRate).toBe(0)
            expect(result.totalRevenue).toBe(0)
            expect(result.activeProductCount).toBe(0)
            expect(result.distributorCount).toBe(0)
            expect(result.pendingWithdrawalCount).toBe(0)
            expect(result.pendingWithdrawalAmount).toBe(0)
            expect(result.pendingCommissionAmount).toBe(0)
        })
    })

    describe("getDashboardTrend", () => {
        it("returns array of length equal to days with 净收入 field", async () => {
            prismaMock.order.groupBy.mockResolvedValueOnce([])
            prismaMock.commission.groupBy.mockResolvedValueOnce([])
            prismaMock.withdrawal.groupBy.mockResolvedValueOnce([])

            const result = await getDashboardTrend(7)

            expect(result).toHaveLength(7)
            expect(result.every(
                (r) => typeof r.date === "string" &&
                    typeof r.订单 === "number" &&
                    typeof r.营收 === "number" &&
                    typeof r.净收入 === "number"
            )).toBe(true)
        })

        it("calculates 净收入 as revenue minus commission plus fee for each day", async () => {
            const testDay = new Date("2024-02-13T12:00:00.000Z")
            prismaMock.order.groupBy.mockResolvedValueOnce([
                { createdAt: testDay, _sum: { amount: 100 }, _count: { id: 1 } },
            ])
            prismaMock.commission.groupBy.mockResolvedValueOnce([
                { createdAt: testDay, _sum: { amount: 20 } },
            ])
            prismaMock.withdrawal.groupBy.mockResolvedValueOnce([
                { processedAt: testDay, _sum: { feeAmount: 2 } },
            ])

            const result = await getDashboardTrend(7)
            const dayResult = result.find((r) => r.营收 === 100)
            // net = 100 - 20 + 2 = 82
            expect(dayResult?.净收入).toBe(82)
        })
    })

    describe("getOrderStatusDistribution", () => {
        it("returns labels and counts for each status", async () => {
            prismaMock.order.groupBy.mockResolvedValueOnce([
                { status: "COMPLETED", _count: { id: 10 } },
                { status: "PENDING", _count: { id: 2 } },
                { status: "CLOSED", _count: { id: 1 } },
            ])

            const result = await getOrderStatusDistribution()

            expect(result).toHaveLength(3)
            expect(result.find((r) => r.status === "COMPLETED")).toMatchObject({
                label: "已完成",
                count: 10,
            })
            expect(result.find((r) => r.status === "PENDING")).toMatchObject({
                label: "待支付",
                count: 2,
            })
        })
    })

    describe("getTopProductsByRevenue", () => {
        it("returns products sorted by revenue with names", async () => {
            prismaMock.order.groupBy.mockResolvedValueOnce([
                { productId: "p1", _sum: { amount: 500 }, _count: { id: 5 } },
                { productId: "p2", _sum: { amount: 300 }, _count: { id: 3 } },
            ])
            prismaMock.product.findMany.mockResolvedValueOnce([
                { id: "p1", name: "Product A" },
                { id: "p2", name: "Product B" },
            ])

            const result = await getTopProductsByRevenue(5)

            expect(result).toHaveLength(2)
            expect(result[0]).toMatchObject({
                productId: "p1",
                productName: "Product A",
                revenue: 500,
                orderCount: 5,
            })
            expect(result[1].revenue).toBe(300)
        })
    })

    describe("getInventoryByProduct", () => {
        it("returns inventory rows with isLowStock flag", async () => {
            prismaMock.card.groupBy.mockResolvedValueOnce([
                { productId: "p1", _count: { id: 2 } },
                { productId: "p2", _count: { id: 10 } },
            ])
            prismaMock.product.findMany.mockResolvedValueOnce([
                { id: "p1", name: "Low Stock" },
                { id: "p2", name: "OK Stock" },
            ])

            const result = await getInventoryByProduct()

            expect(result).toHaveLength(2)
            const low = result.find((r) => r.productId === "p1")
            expect(low?.isLowStock).toBe(true)
            expect(low?.unsoldCount).toBe(2)
            const ok = result.find((r) => r.productId === "p2")
            expect(ok?.isLowStock).toBe(false)
        })
    })

    describe("getRestockPending", () => {
        it("returns pending count per product with names", async () => {
            prismaMock.restockSubscription.groupBy.mockResolvedValueOnce([
                { productId: "p1", _count: { id: 4 } },
            ])
            prismaMock.product.findMany.mockResolvedValueOnce([
                { id: "p1", name: "Out of Stock" },
            ])

            const result = await getRestockPending()

            expect(result).toHaveLength(1)
            expect(result[0]).toMatchObject({
                productId: "p1",
                productName: "Out of Stock",
                pendingCount: 4,
            })
        })
    })

    describe("getRecentOrders", () => {
        it("returns orders with product relation", async () => {
            prismaMock.order.findMany.mockResolvedValueOnce([
                {
                    id: "o1",
                    orderNo: "NO001",
                    productId: "p1",
                    amount: 99,
                    status: "COMPLETED",
                    product: { id: "p1", name: "Prod" },
                } as any,
            ])

            const result = await getRecentOrders(10)

            expect(result).toHaveLength(1)
            expect(prismaMock.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 10,
                    orderBy: { createdAt: "desc" },
                    include: { product: { select: { id: true, name: true } } },
                })
            )
        })
    })

    describe("getDashboardData", () => {
        it("returns all sections in one call with new profit fields", async () => {
            const zeroAggregate = { _sum: { amount: null, feeAmount: null }, _count: { id: 0 } }
            prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } })
            prismaMock.order.count.mockResolvedValue(0)
            prismaMock.order.groupBy.mockResolvedValue([])
            prismaMock.card.count.mockResolvedValue(0)
            prismaMock.card.groupBy.mockResolvedValue([])
            prismaMock.restockSubscription.count.mockResolvedValue(0)
            prismaMock.restockSubscription.groupBy.mockResolvedValue([])
            prismaMock.product.findMany.mockResolvedValue([])
            prismaMock.product.count.mockResolvedValue(0)
            prismaMock.user.count.mockResolvedValue(0)
            prismaMock.withdrawal.aggregate.mockResolvedValue(zeroAggregate)
            prismaMock.withdrawal.groupBy.mockResolvedValue([])
            prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: null } })
            prismaMock.commission.groupBy.mockResolvedValue([])
            prismaMock.order.findMany.mockResolvedValue([])

            const result = await getDashboardData()

            expect(result).toHaveProperty("kpis")
            expect(result).toHaveProperty("trend7")
            expect(result).toHaveProperty("trend30")
            expect(result).toHaveProperty("orderStatusDistribution")
            expect(result).toHaveProperty("topProducts")
            expect(result).toHaveProperty("inventory")
            expect(result).toHaveProperty("restockPending")
            expect(result).toHaveProperty("recentOrders")
            expect(result.trend7).toHaveLength(7)
            expect(result.trend30).toHaveLength(30)
            expect(result.kpis).toMatchObject({
                activeProductCount: 0,
                distributorCount: 0,
                pendingWithdrawalCount: 0,
                pendingWithdrawalAmount: 0,
                pendingCommissionAmount: 0,
                totalCommission: 0,
                totalWithdrawalFee: 0,
                netIncome: 0,
                netMarginPercent: 0,
            })
            // trend points include 净收入
            expect(result.trend7.every((p) => typeof p.净收入 === "number")).toBe(true)
        })
    })
})
