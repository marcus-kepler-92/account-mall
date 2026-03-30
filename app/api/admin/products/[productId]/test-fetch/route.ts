import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import { config } from "@/lib/config"
import { badRequest, notFound, unauthorized, serviceUnavailable } from "@/lib/api-response"

type RouteContext = { params: Promise<{ productId: string }> }

/**
 * POST /api/admin/products/[productId]/test-fetch
 * Admin-only: scrape the AUTO_FETCH source URL and return accounts with blacklist status.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, productType: true, sourceUrl: true },
    })

    if (!product) return notFound("商品不存在")
    if (product.productType !== "AUTO_FETCH") return badRequest("仅 AUTO_FETCH 商品支持测试爬取")

    const sourceUrl = (product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    if (!sourceUrl) return badRequest("未配置爬取来源")

    const [scrapedList, blacklisted] = await Promise.all([
        scrapeMultipleUrls(sourceUrl),
        prisma.accountBlacklist.findMany({
            where: { productId: product.id },
            select: { account: true },
        }),
    ])

    if (scrapedList.length === 0) {
        return serviceUnavailable("爬取返回空列表，请检查来源 URL")
    }

    const blackSet = new Set(blacklisted.map((b) => b.account))
    const accounts = scrapedList.map((a) => ({
        account: a.account,
        password: a.password,
        region: a.region ?? "",
        isBlacklisted: blackSet.has(a.account),
    }))

    return NextResponse.json({
        sourceUrl,
        total: accounts.length,
        availableCount: accounts.filter((a) => !a.isBlacklisted).length,
        blacklistedCount: blacklisted.length,
        accounts,
    })
}

export const runtime = "nodejs"
