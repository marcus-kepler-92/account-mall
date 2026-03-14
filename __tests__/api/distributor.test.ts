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
    config: { siteUrl: "http://localhost:3000", withdrawalMinAmount: 50, withdrawalFeePercent: 2 },
    getConfig: () => ({ siteUrl: "http://localhost:3000", withdrawalMinAmount: 50, withdrawalFeePercent: 2 }),
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
        formData.set("receiptImage", new File(["x"], "receipt.jpg", { type: "image/jpeg" }))
    }
    return {
        url: "http://localhost/api/distributor/withdrawals",
        headers: { get: () => "multipart/form-data; boundary=----FormBoundary" },
        formData: () => Promise.resolve(formData),
    } as unknown as NextRequest
}

function createWithdrawalFormRequestWithFile(amount: string, fileType: string, fileSize: number): NextRequest {
    const formData = new FormData()
    formData.set("amount", amount)
    const file = new File([new Uint8Array(fileSize)], "receipt.jpg", { type: fileType })
    formData.set("receiptImage", file)
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
        expect(data.withdrawalMinAmount).toBe(50)
    })

    it("queries commissions only for current user (distributorId from session, no IDOR)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.commission.findMany.mockResolvedValue([])
        prismaMock.commission.count.mockResolvedValue(0)
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: null } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: null } })
            .mockResolvedValueOnce({ _sum: { amount: null } })

        const req = createRequest("http://localhost/api/distributor/commissions")
        await CommissionsGet(req)

        expect(prismaMock.commission.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ distributorId: "dist_1" }),
            })
        )
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

    it("returns 401 when distributor is disabled (getDistributorSession returns null)", async () => {
        getDistributorSession.mockResolvedValue(null)
        const req = createWithdrawalFormRequest("10")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(401)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("returns 400 when receipt image is missing or not uploaded", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("50", false)
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/收款码|上传|图片/i)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("returns 429 when withdrawal create rate limit is exceeded", async () => {
        const { checkWithdrawalCreateRateLimit } = require("@/lib/rate-limit")
        checkWithdrawalCreateRateLimit.mockResolvedValueOnce(
            new Response(
                JSON.stringify({ error: "提现申请过于频繁，请稍后再试。" }),
                { status: 429, headers: { "Content-Type": "application/json" } }
            )
        )
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("50")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(429)
        const data = await res.json()
        expect(data.error).toMatch(/频繁|稍后/i)
        expect(prismaMock.$transaction).not.toHaveBeenCalled()
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
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

    it("returns 400 when amount is below withdrawal minimum amount (e.g. 20 < 50)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("20")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/至少.*50|50.*元/)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("returns 400 when amount is just below withdrawal minimum amount (e.g. 49)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequest("49")
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/至少.*50|50.*元/)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("rounds amount to 2 decimals and creates withdrawal (e.g. 50.999 -> 51)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 200 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_1",
            amount: 51,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("50.999")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data.amount).toBe(51)
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                distributorId: "dist_1",
                amount: 51,
                feePercent: 2,
                feeAmount: 1.02,
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

    it("returns 201 and creates withdrawal when amount is valid (at minimum amount boundary)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_1",
            amount: 50,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("50")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data).toMatchObject({
            id: "with_1",
            amount: 50,
            status: "PENDING",
        })
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: {
                distributorId: "dist_1",
                amount: 50,
                feePercent: 2,
                feeAmount: 1,
                status: "PENDING",
                receiptImageUrl: "/uploads/receipts/test.jpg",
            },
        })
    })

    it("returns 201 when amount equals withdrawable balance (boundary allowed)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 20 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_1",
            amount: 80,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("80")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data.amount).toBe(80)
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                distributorId: "dist_1",
                amount: 80,
                status: "PENDING",
            }),
        })
    })

    it("returns 400 when receipt image type is not allowed (e.g. image/gif)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const req = createWithdrawalFormRequestWithFile("50", "image/gif", 100)
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/JPG|PNG|WebP|支持|图片/i)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("returns 400 when receipt image size exceeds 4MB", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        const overLimit = 4 * 1024 * 1024 + 1
        const req = createWithdrawalFormRequestWithFile("50", "image/jpeg", overLimit)
        const res = await WithdrawalsPost(req)
        expect(res.status).toBe(400)
        const data = await res.json()
        expect(data.error).toMatch(/4MB|大小|超过/i)
        expect(prismaMock.withdrawal.create).not.toHaveBeenCalled()
    })

    it("creates withdrawal with feePercent=2 and correct feeAmount", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 200 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_fee",
            amount: 100,
            feePercent: 2,
            feeAmount: 2,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("100")
        const res = await WithdrawalsPost(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ amount: 100, feePercent: 2, feeAmount: 2 }),
        })
        expect(data.feeAmount).toBe(2)
        expect(data.actualAmount).toBe(98)
    })

    it("calculates feeAmount rounded to 2 decimal places (83.33 * 2% = 1.67)", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 200 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_fee2",
            amount: 83.33,
            feePercent: 2,
            feeAmount: 1.67,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        // 83.33 * 2% = Math.round(166.66) / 100 = 167 / 100 = 1.67
        const req = createWithdrawalFormRequest("83.33")
        await WithdrawalsPost(req)

        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ amount: 83.33, feePercent: 2, feeAmount: 1.67 }),
        })
    })

    it("creates withdrawal with feeAmount=0 when feePercent is 0", async () => {
        const { config } = require("@/lib/config")
        const originalFee = config.withdrawalFeePercent
        config.withdrawalFeePercent = 0

        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock))
        prismaMock.commission.aggregate.mockResolvedValue({ _sum: { amount: 200 } })
        prismaMock.withdrawal.aggregate
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
        prismaMock.withdrawal.create.mockResolvedValue({
            id: "with_nofee",
            amount: 100,
            feePercent: 0,
            feeAmount: 0,
            status: "PENDING",
            receiptImageUrl: "/uploads/receipts/test.jpg",
            createdAt: new Date(),
        })

        const req = createWithdrawalFormRequest("100")
        await WithdrawalsPost(req)

        expect(prismaMock.withdrawal.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ feePercent: 0, feeAmount: 0 }),
        })

        config.withdrawalFeePercent = originalFee
    })

    it("GET returns feeAmount and actualAmount for each withdrawal", async () => {
        getDistributorSession.mockResolvedValue(distributorSession)
        prismaMock.withdrawal.findMany.mockResolvedValue([
            {
                id: "w1",
                amount: 100,
                feePercent: 2,
                feeAmount: 2,
                status: "PENDING",
                receiptImageUrl: null,
                note: null,
                processedAt: null,
                createdAt: new Date(),
            },
        ])
        prismaMock.withdrawal.count.mockResolvedValue(1)

        const url = "http://localhost/api/distributor/withdrawals"
        const req = { url } as unknown as NextRequest
        const res = await WithdrawalsGet(req)
        const body = await res.json()

        expect(res.status).toBe(200)
        const w = body.data[0]
        expect(w.feeAmount).toBe(2)
        expect(w.actualAmount).toBe(98)
    })
})
