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

    describe("getDashboardKpis", () => {
        it("returns kpis with correct shape and computed values", async () => {
            prismaMock.order.aggregate.mockResolvedValueOnce({
                _sum: { amount: 1000 },
                _count: { id: 20 },
            })
            prismaMock.order.aggregate.mockResolvedValueOnce({
                _sum: { amount: 800 },
            })
            prismaMock.order.count.mockResolvedValueOnce(30)
            prismaMock.order.count.mockResolvedValueOnce(10)
            prismaMock.order.count.mockResolvedValueOnce(15)
            prismaMock.order.groupBy.mockResolvedValueOnce([
                { status: "COMPLETED", _count: { id: 20 } },
                { status: "PENDING", _count: { id: 5 } },
                { status: "CLOSED", _count: { id: 5 } },
            ])
            prismaMock.card.count.mockResolvedValueOnce(50)
            prismaMock.restockSubscription.count.mockResolvedValueOnce(3)

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
            })
            expect(typeof result.revenueTrend).toBe("number")
            expect(typeof result.orderTrend).toBe("number")
        })

        it("handles zero completed orders (AOV and completion rate)", async () => {
            prismaMock.order.aggregate.mockResolvedValueOnce({
                _sum: { amount: 0 },
                _count: { id: 0 },
            })
            prismaMock.order.aggregate.mockResolvedValueOnce({ _sum: { amount: 0 } })
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.order.count.mockResolvedValueOnce(0)
            prismaMock.order.groupBy.mockResolvedValueOnce([])
            prismaMock.card.count.mockResolvedValueOnce(0)
            prismaMock.restockSubscription.count.mockResolvedValueOnce(0)

            const result = await getDashboardKpis()

            expect(result.aov).toBe(0)
            expect(result.completionRate).toBe(0)
            expect(result.totalRevenue).toBe(0)
        })
    })

    describe("getDashboardTrend", () => {
        it("returns array of length equal to days", async () => {
            prismaMock.order.groupBy.mockResolvedValueOnce([])

            const result = await getDashboardTrend(7)

            expect(result).toHaveLength(7)
            expect(result.every((r) => typeof r.date === "string" && typeof r.订单 === "number" && typeof r.营收 === "number")).toBe(true)
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
        it("returns all sections in one call", async () => {
            prismaMock.order.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } })
            prismaMock.order.count.mockResolvedValue(0)
            prismaMock.order.groupBy.mockResolvedValue([])
            prismaMock.card.count.mockResolvedValue(0)
            prismaMock.card.groupBy.mockResolvedValue([])
            prismaMock.restockSubscription.count.mockResolvedValue(0)
            prismaMock.restockSubscription.groupBy.mockResolvedValue([])
            prismaMock.product.findMany.mockResolvedValue([])
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
        })
    })
})
