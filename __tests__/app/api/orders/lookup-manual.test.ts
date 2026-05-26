/**
 * POST /api/orders/lookup — MANUAL product support
 *
 * - MANUAL COMPLETED order → cards: [], fulfillment: { content }, productType: "MANUAL"
 * - MANUAL AWAITING_FULFILLMENT order → status: "AWAITING_FULFILLMENT", variantName, fulfillment: null,
 *   dunCount, lastDunAt; cards: []
 * - NORMAL COMPLETED order → backward-compatible response: cards as before, productType: "NORMAL",
 *   fulfillment: null
 */
import { type NextRequest } from "next/server"
import { POST } from "@/app/api/orders/lookup/route"
import { prismaMock } from "../../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("better-auth/crypto", () => ({
    __esModule: true,
    verifyPassword: jest.fn().mockResolvedValue(true),
}))

jest.mock("@/lib/rate-limit", () => ({
    __esModule: true,
    checkOrderQueryRateLimit: jest.fn().mockResolvedValue(null),
}))

jest.mock("@/lib/order-success-token", () => ({
    __esModule: true,
    createOrderSuccessToken: jest.fn().mockReturnValue("mock-success-token"),
}))

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: {
        pendingOrderTimeoutMs: 30 * 60 * 1000,
    },
}))

const ORDER_NO = "FAK-MANUAL-1"
const PASSWORD = "secret123"

function makeRequest(body: unknown): NextRequest {
    return {
        json: async () => body,
    } as unknown as NextRequest
}

function makeManualProductSelect(overrides?: Partial<Record<string, unknown>>) {
    return {
        name: "Manual Product",
        productType: "MANUAL",
        allowAccountSwitch: true,
        accountSwitchLimit: 1,
        cardTemplates: [],
        ...overrides,
    }
}

function makeNormalProductSelect(overrides?: Partial<Record<string, unknown>>) {
    return {
        name: "Normal Product",
        productType: "NORMAL",
        allowAccountSwitch: true,
        accountSwitchLimit: 1,
        cardTemplates: [],
        ...overrides,
    }
}

function setupTxOrder(order: unknown) {
    ;(prismaMock.$transaction as jest.Mock).mockImplementationOnce(async (cb: any) => {
        // The route's transaction uses tx.order.findUnique — return the prepared order.
        const tx = {
            order: {
                findUnique: jest.fn().mockResolvedValue(order),
            },
        }
        return await cb(tx)
    })
}

describe("POST /api/orders/lookup — MANUAL support", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(prismaMock.$transaction as jest.Mock).mockReset()
    })

    it("MANUAL COMPLETED order returns fulfillment.content + empty cards + productType: MANUAL", async () => {
        const fulfillmentContent = "账号：abc@example.com\n密码：p@ssw0rd"
        setupTxOrder({
            id: "cmanualorder0000000000001",
            orderNo: ORDER_NO,
            email: "buyer@example.com",
            passwordHash: "$2b$10$hash",
            productNameSnapshot: "Manual Product Snapshot",
            variantNameSnapshot: "10K 钻石",
            status: "COMPLETED",
            amount: 88.5,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            expiresAt: null,
            switchAccountCount: 0,
            dunCount: 1,
            lastDunAt: new Date("2026-01-01T00:30:00Z"),
            product: makeManualProductSelect(),
            cards: [], // MANUAL orders have no Card rows
            fulfillment: { content: fulfillmentContent },
        })

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, password: PASSWORD }),
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.productType).toBe("MANUAL")
        expect(body.cards).toEqual([])
        expect(body.fulfillment).toEqual({ content: fulfillmentContent })
        expect(body.variantName).toBe("10K 钻石")
        expect(body.status).toBe("COMPLETED")
    })

    it("MANUAL AWAITING_FULFILLMENT returns status + variantName + cards:[] + fulfillment:null", async () => {
        setupTxOrder({
            id: "cmanualorder0000000000002",
            orderNo: ORDER_NO,
            email: "buyer@example.com",
            passwordHash: "$2b$10$hash",
            productNameSnapshot: "Manual Product Snapshot",
            variantNameSnapshot: "5K 金币",
            status: "AWAITING_FULFILLMENT",
            amount: 50,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            expiresAt: null,
            switchAccountCount: 0,
            dunCount: 0,
            lastDunAt: null,
            product: makeManualProductSelect(),
            cards: [],
            fulfillment: null,
        })

        const res = await POST(
            makeRequest({ orderNo: ORDER_NO, password: PASSWORD }),
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.status).toBe("AWAITING_FULFILLMENT")
        expect(body.productType).toBe("MANUAL")
        expect(body.variantName).toBe("5K 金币")
        expect(body.cards).toEqual([])
        expect(body.fulfillment).toBeNull()
        expect(body.dunCount).toBe(0)
        expect(body.lastDunAt).toBeNull()
    })

    it("NORMAL COMPLETED order: backward-compatible (cards preserved, productType:NORMAL, fulfillment:null)", async () => {
        setupTxOrder({
            id: "cnormalorder0000000000001",
            orderNo: "FAK-NORMAL-1",
            email: "buyer@example.com",
            passwordHash: "$2b$10$hash",
            productNameSnapshot: "Normal Product Snapshot",
            variantNameSnapshot: null,
            status: "COMPLETED",
            amount: 20,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            expiresAt: null,
            switchAccountCount: 0,
            dunCount: 0,
            lastDunAt: null,
            product: makeNormalProductSelect(),
            cards: [
                { id: "card-1", content: "card-content-1", status: "SOLD" },
                { id: "card-2", content: "card-content-2", status: "SOLD" },
                { id: "card-3", content: "should-be-filtered", status: "UNSOLD" },
            ],
            fulfillment: null,
        })

        const res = await POST(
            makeRequest({ orderNo: "FAK-NORMAL-1", password: PASSWORD }),
        )
        const body = await res.json()

        expect(res.status).toBe(200)
        expect(body.productType).toBe("NORMAL")
        expect(body.fulfillment).toBeNull()
        // Only SOLD/RESERVED cards leak through; UNSOLD is filtered out.
        expect(body.cards).toEqual([
            { content: "card-content-1" },
            { content: "card-content-2" },
        ])
    })
})
