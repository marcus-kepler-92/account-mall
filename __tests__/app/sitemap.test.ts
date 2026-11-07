import sitemap from "@/app/sitemap"
import { prismaMock } from "../../__mocks__/prisma"

jest.mock("@/lib/prisma", () => {
    const { prismaMock } = require("../../__mocks__/prisma")
    return { __esModule: true, prisma: prismaMock }
})

jest.mock("@/lib/config", () => ({
    __esModule: true,
    config: { siteUrl: "https://shop.test" },
}))

jest.mock("@/lib/articles", () => ({
    __esModule: true,
    getPublishedArticles: jest.fn(),
}))

const getPublishedArticles = require("@/lib/articles").getPublishedArticles as jest.Mock

describe("sitemap", () => {
    beforeEach(() => {
        prismaMock.product.findMany.mockResolvedValue([
            { slug: "apple-id-us", updatedAt: new Date("2026-10-01T00:00:00Z") },
        ] as never)
    })

    it("omits /guides while no article is published", async () => {
        getPublishedArticles.mockResolvedValue([])
        const urls = (await sitemap()).map((e) => e.url)
        expect(urls).not.toContain("https://shop.test/guides")
    })

    it("lists /guides and each published article with its lastmod", async () => {
        getPublishedArticles.mockResolvedValue([
            { slug: "a", title: "A", summary: null, publishedAt: null, updatedAt: "2026-11-01T00:00:00.000Z" },
            { slug: "b", title: "B", summary: null, publishedAt: null, updatedAt: "2026-11-05T00:00:00.000Z" },
        ])
        const entries = await sitemap()
        const byUrl = Object.fromEntries(entries.map((e) => [e.url, e]))

        expect(byUrl["https://shop.test/guides/a"].lastModified).toEqual(new Date("2026-11-01T00:00:00.000Z"))
        expect(byUrl["https://shop.test/guides"].lastModified).toEqual(new Date("2026-11-05T00:00:00.000Z"))
        expect(byUrl["https://shop.test/products/apple-id-us"]).toBeDefined()
    })
})
