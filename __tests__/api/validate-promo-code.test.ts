import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { GET } from "@/app/api/validate-promo-code/route"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/rate-limit", () => ({
    checkValidatePromoCodeRateLimit: jest.fn().mockResolvedValue(null),
}))

describe("GET /api/validate-promo-code", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it("returns valid: false when promoCode is missing", async () => {
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toEqual({ valid: false, discountPercent: null })
        expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    })

    it("returns valid: false when promoCode is empty after trim", async () => {
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=%20%20")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toEqual({ valid: false, discountPercent: null })
    })

    it("returns valid: false when no distributor matches", async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce(null)
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=INVALID")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toEqual({ valid: false, discountPercent: null })
        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
            where: { distributorCode: "INVALID", role: "DISTRIBUTOR", disabledAt: null },
            select: { id: true, discountCodeEnabled: true, discountPercent: true },
        })
    })

    it("returns valid: true and discountPercent when distributor has discount enabled", async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "u1",
            discountCodeEnabled: true,
            discountPercent: new Prisma.Decimal("5"),
        } as any)
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=PROMO1")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        expect(data).toEqual({ valid: true, discountPercent: 5 })
    })

    it("returns admin-set discountPercent when it exceeds the base discount", async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "u1",
            discountCodeEnabled: true,
            discountPercent: new Prisma.Decimal("10"),
        } as any)
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=PROMO1")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        // Admin-set 10% overrides the 5% base
        expect(data).toEqual({ valid: true, discountPercent: 10 })
    })

    it("returns valid: true and discountPercent null when discountCodeEnabled is false", async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "u1",
            discountCodeEnabled: false,
            discountPercent: new Prisma.Decimal("5"),
        } as any)
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=PROMO1")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        // Master switch off → no discount at all
        expect(data).toEqual({ valid: true, discountPercent: null })
    })

    it("returns base discountPercent when discountCodeEnabled is true but discountPercent not set", async () => {
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: "u1",
            discountCodeEnabled: true,
            discountPercent: null,
        } as any)
        const req = new NextRequest("http://localhost:3000/api/validate-promo-code?promoCode=PROMO1")
        const res = await GET(req)
        const data = await res.json()
        expect(res.status).toBe(200)
        // Enabled with no custom rate → base 5%
        expect(data).toEqual({ valid: true, discountPercent: 5 })
    })
})
