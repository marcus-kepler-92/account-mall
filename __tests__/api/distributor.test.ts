import { type NextRequest } from "next/server"
import { GET as MeGet } from "@/app/api/distributor/me/route"
import { GET as OrdersGet } from "@/app/api/distributor/orders/route"
import { GET as CommissionsGet } from "@/app/api/distributor/commissions/route"
import { GET as WithdrawalsGet, POST as WithdrawalsPost } from "@/app/api/distributor/withdrawals/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/auth-guard", () => ({
    __esModule: true,
    getDistributorSession: jest.fn(),
}))

jest.mock("@/lib/config", () => ({
    config: { siteUrl: "http://localhost:3000" },
    getConfig: () => ({ siteUrl: "http://localhost:3000" }),
}))

jest.mock("@/lib/upload", () => ({
    uploadBinary: jest.fn().mockResolvedValue("/uploads/receipts/test.jpg"),
    DEFAULT_MAX_BYTES: 4 * 1024 * 1024,
}))

jest.mock("@/lib/rate-limit", () => ({
    checkWithdrawalCreateRateLimit: jest.fn().mockResolvedValue(null),
}))

const getDistributorSession = require("@/lib/auth-guard").getDistributorSession as jest.Mock

const distributorSession = {
    user: {
        id: "dist_1",
        email: "dist@example.com",
        name: "Distributor",
        distributorCode: "PROMO1",
    },
}

function createRequest(url = "http://localhost/api/distributor/me"): NextRequest {
    return { url } as NextRequest
}

function createWithdrawalFormRequest(amount: string, withFile = true): NextRequest {
    const formData = new FormData()
    formData.set("amount", amount)
    if (withFile) {
        formData.set("receiptImage", new Blob(["x"], { type: "image/jpeg" }) as unknown as File)
    }
    return {
        url: "http://localhost/api/distributor/withdrawals",
        headers: { get: () => "multipart/form-data; boundary=----FormBoundary" },
        formData: () => Promise.resolve(formData),
    } as unknown as NextRequest
}

describe("GET /api/distributor/me", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const res = await MeGet()
        expect(res.status).toBe(401)
    })

    it("returns 200 with promoUrl and withdrawableBalance when session has distributorCode", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 20 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.order.findMany.mockResolvedValue([])
        prismaMock.commissionTier.findMany.mockResolvedValue([])

        const res = await MeGet()
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data).toMatchObject({
            id: "dist_1",
            email: "dist@example.com",
            distributorCode: "PROMO1",
            promoUrl: "http://localhost:3000/?promoCode=PROMO1",
            withdrawableBalance: 80,
        })
        expect(data.weeklySalesTotal).toBe(0)
        expect(data.tiersList).toEqual([])
        expect(data.encouragementMessage).toBeDefined()
    })

    it("generates distributorCode via user.update when user has none", async () => {
        getDistributorSession.mockResolvedValue({
            user: { id: "dist_1", email: "d@x.com", name: "D", distributorCode: null },
        })
        prismaMock.user.update.mockResolvedValue({
            id: "dist_1",
            distributorCode: "D00000001",
        })
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: null } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: null } })
            .mockResolvedValueOnce({ _sum: { amount: null } })
        prismaMock.order.findMany.mockResolvedValue([])
        prismaMock.commissionTier.findMany.mockResolvedValue([])

        const res = await MeGet()
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "dist_1" },
            data: { distributorCode: expect.stringMatching(/^D[A-Z0-9_]+$/) },
        })
        expect(data.promoUrl).toContain("promoCode=")
        expect(data.withdrawableBalance).toBe(0)
    })
})

describe("GET /api/distributor/orders", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const req = createRequest("http://localhost/api/distributor/orders")
        const res = await OrdersGet(req)
        expect(res.status).toBe(401)
    })

    it("returns 200 with data and meta when session present", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.order.findMany.mockResolvedValue([
            {
                id: "ord_1",
                orderNo: "no-1",
                product: { id: "p1", name: "P", slug: "p", price: 50 },
                quantity: 1,
                amount: 50,
                status: "COMPLETED",
                paidAt: new Date(),
                createdAt: new Date(),
            },
        ])
        prismaMock.order.count.mockResolvedValue(1)

        const req = createRequest("http://localhost/api/distributor/orders?page=1&pageSize=20")
        const res = await OrdersGet(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data).toHaveLength(1)
        expect(data.meta).toMatchObject({ total: 1, page: 1, pageSize: 20 })
        expect(prismaMock.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { distributorId: "dist_1" },
                skip: 0,
                take: 20,
            })
        )
    })
})

describe("GET /api/distributor/commissions", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const req = createRequest("http://localhost/api/distributor/commissions")
        const res = await CommissionsGet(req)
        expect(res.status).toBe(401)
    })

    it("returns 200 with data, meta and withdrawableBalance", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.commission.findMany.mockResolvedValue([
            {
                id: "c1",
                orderId: "ord_1",
                amount: 10,
                status: "SETTLED",
                createdAt: new Date(),
                order: { orderNo: "no-1", amount: 100, paidAt: new Date() },
            },
        ])
        prismaMock.commission.count.mockResolvedValue(1)
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 50 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 10 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })

        const req = createRequest("http://localhost/api/distributor/commissions")
        const res = await CommissionsGet(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data).toHaveLength(1)
        expect(data.withdrawableBalance).toBe(40)
        expect(data.meta).toBeDefined()
    })
})

describe("GET /api/distributor/withdrawals", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const req = createRequest("http://localhost/api/distributor/withdrawals")
        const res = await WithdrawalsGet(req)
        expect(res.status).toBe(401)
    })

    it("returns 200 with data and meta", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.withdrawal.findMany.mockResolvedValue([
            {
                id: "w1",
                amount: 50,
                status: "PAID",
                note: null,
                processedAt: new Date(),
                createdAt: new Date(),
            },
        ])
        prismaMock.withdrawal.count.mockResolvedValue(1)

        const req = createRequest("http://localhost/api/distributor/withdrawals")
        const res = await WithdrawalsGet(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data).toHaveLength(1)
        expect(data.meta).toMatchObject({ total: 1 })
        expect(prismaMock.withdrawal.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { distributorId: "dist_1" },
            })
        )
    })
})

describe("POST /api/distributor/withdrawals", () => {
    beforeEach(() => {
        getDistributorSession.mockReset()
    })

    it("returns 401 when no session", async () => {
        getDistributorSession.mockResolvedValue(null)
        const req = {
            json: async () => ({ amount: 10 }),
        } as unknown as NextRequest
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(401)
    })

    it("returns 400 when body is invalid (non-number amount)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("not-a-number")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toBeDefined()
    })

    it("returns 400 when amount is not positive", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("0")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
    })

    it("returns 400 when amount is below minimum 0.01", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("0.001")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/至少|0\.01/)
    })

    it("rounds amount to 2 decimals and creates withdrawal (e.g. 1.999 -> 2)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_1",
            amount: 2,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("1.999")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data.amount).toBe(2)
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                distributorId: "dist_1",
                amount: 2,
                status: "PENDING",
                receiptImageUrl: "/uploads/receipts/test.jpg",
            }),
        })
    })

    it("returns 400 when amount exceeds withdrawable balance", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 80 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })

        const req = createWithdrawalFormRequest("50")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toMatch(/可提现余额|超额/)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("returns 201 and creates withdrawal when amount is valid", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 20 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_1",
            amount: 30,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("30")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({
            id: "with_1",
            amount: 30,
            status: "PENDING",
        })
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: {
                distributorId: "dist_1",
                amount: 30,
                status: "PENDING",
                receiptImageUrl: "/uploads/receipts/test.jpg",
            },
        })
    })
})
