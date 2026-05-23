import { Prisma } from "@prisma/client"
import { GET } from "@/app/api/cs/products/route"
import { prismaMock } from "../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../__mocks__/prisma")
    return {
        __esModule: true,
        prisma: prismaMock,
    }
})

describe("GET /api/cs/products", () => {
    it("includes MANUAL product as inStock when active variants have stock", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([
            {
                name: "Manual Sku Product",
                summary: "manual product summary",
                price: new Prisma.Decimal("19.9"),
                productType: "MANUAL",
                tags: [{ name: "vip" }],
                _count: { cards: 0, variants: 3 },
            },
        ] as any)

        const res = await GET()
        const data = await res.json()

        expect(res.status).toBe(200)
        // Verify Prisma was asked for both cards and variants counts with the
        // correct filters — required for MANUAL stock detection.
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: expect.objectContaining({
                    _count: {
                        select: expect.objectContaining({
                            cards: { where: { status: "UNSOLD" } },
                            variants: {
                                where: { isActive: true, stockQuantity: { gt: 0 } },
                            },
                        }),
                    },
                }),
            })
        )
        expect(data.data).toHaveLength(1)
        expect(data.data[0]).toMatchObject({
            name: "Manual Sku Product",
            productType: "MANUAL",
            price: 19.9,
            inStock: true,
            tags: ["vip"],
        })
    })

    it("reports MANUAL product as out of stock when no active variants have stock", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([
            {
                name: "Manual Empty",
                summary: null,
                price: new Prisma.Decimal("50"),
                productType: "MANUAL",
                tags: [],
                _count: { cards: 0, variants: 0 },
            },
        ] as any)

        const res = await GET()
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data[0]).toMatchObject({
            name: "Manual Empty",
            productType: "MANUAL",
            inStock: false,
        })
    })

    it("keeps NORMAL inStock semantics (cards-based)", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([
            {
                name: "Normal With Cards",
                summary: null,
                price: new Prisma.Decimal("9.9"),
                productType: "NORMAL",
                tags: [],
                _count: { cards: 4, variants: 0 },
            },
            {
                name: "Normal No Cards",
                summary: null,
                price: new Prisma.Decimal("9.9"),
                productType: "NORMAL",
                tags: [],
                _count: { cards: 0, variants: 0 },
            },
        ] as any)

        const res = await GET()
        const data = await res.json()

        expect(data.data[0]).toMatchObject({ name: "Normal With Cards", inStock: true })
        expect(data.data[1]).toMatchObject({ name: "Normal No Cards", inStock: false })
    })

    it("always reports AUTO_FETCH as inStock regardless of cards/variants counts", async () => {
        prismaMock.product.findMany.mockResolvedValueOnce([
            {
                name: "Auto Fetch",
                summary: null,
                price: new Prisma.Decimal("0"),
                productType: "AUTO_FETCH",
                tags: [],
                _count: { cards: 0, variants: 0 },
            },
        ] as any)

        const res = await GET()
        const data = await res.json()

        expect(data.data[0]).toMatchObject({
            name: "Auto Fetch",
            productType: "AUTO_FETCH",
            inStock: true,
        })
    })
})
