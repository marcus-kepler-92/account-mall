import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, badRequest, invalidJsonBody } from "@/lib/api-response"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import { config } from "@/lib/config"
import { MANUAL_BLACKLIST_REASON } from "@/lib/auto-fetch-card"

type RouteContext = {
    params: Promise<{ productId: string }>
}

/**
 * GET /api/admin/products/[productId]/blacklist
 * Admin: get the account blacklist for a specific AUTO_FETCH product.
 * Response includes `expiryHours` (from BLACKLIST_EXPIRY_HOURS env) for client-side expiry display.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, productType: true, sourceUrl: true },
    })
    if (!product) return notFound("商品不存在")

    const blacklist = await prisma.accountBlacklist.findMany({
        where: { productId },
        orderBy: { createdAt: "desc" },
    })

    // Scrape latest passwords from source URL
    const sourceUrl = (product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    let scraped: Array<{ account: string; password: string }> = []
    if (sourceUrl) {
        try {
            scraped = await scrapeMultipleUrls(sourceUrl)
        } catch {
            // Scrape failure is non-fatal: passwords will show as null
        }
    }
    const scraped_map = new Map(scraped.map((a) => [a.account, a.password]))

    const enriched = blacklist.map((entry) => ({
        ...entry,
        password: scraped_map.get(entry.account) ?? null,
    }))

    return NextResponse.json({ blacklist: enriched, expiryHours: config.blacklistExpiryHours })
}

/**
 * DELETE /api/admin/products/[productId]/blacklist
 * Admin: remove a single entry ({ id: string }) or clear all entries ({ all: true }).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    let body: { id?: string; all?: boolean }
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    if (body.all) {
        const { count } = await prisma.accountBlacklist.deleteMany({ where: { productId } })
        return NextResponse.json({ removed: count })
    }

    const { id } = body
    if (!id) return badRequest("缺少黑名单记录 ID")

    const entry = await prisma.accountBlacklist.findUnique({
        where: { id },
        select: { id: true, productId: true },
    })

    if (!entry || entry.productId !== productId) return notFound("黑名单记录不存在")

    await prisma.accountBlacklist.delete({ where: { id } })

    return NextResponse.json({ removed: true })
}

/**
 * POST /api/admin/products/[productId]/blacklist
 * Admin: restore auto-blacklisted accounts that are currently available on source.
 * Manual entries (reason = "管理员手动拉黑") are never restored.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, sourceUrl: true },
    })
    if (!product) return notFound("商品不存在")

    const sourceUrl = (product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    if (!sourceUrl) return NextResponse.json({ removed: 0 })

    let availableAccounts: string[] = []
    try {
        const scraped = await scrapeMultipleUrls(sourceUrl)
        availableAccounts = scraped.map((a) => a.account)
    } catch {
        return NextResponse.json({ removed: 0 })
    }

    if (availableAccounts.length === 0) return NextResponse.json({ removed: 0 })

    const { count } = await prisma.accountBlacklist.deleteMany({
        where: {
            productId,
            account: { in: availableAccounts },
            OR: [{ reason: null }, { reason: { not: MANUAL_BLACKLIST_REASON } }],
        },
    })

    return NextResponse.json({ removed: count })
}
