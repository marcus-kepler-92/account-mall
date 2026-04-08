import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import { sharedAccountToCardPayload, toCardContentJson, MANUAL_BLACKLIST_REASON } from "@/lib/auto-fetch-card"
import { config } from "@/lib/config"
import { badRequest, notFound, invalidJsonBody, internalServerError } from "@/lib/api-response"

const REFRESH_COOLDOWN_MS = 60 * 1000 // 1 分钟/次

type RouteContext = {
    params: Promise<{ orderId: string }>
}

/**
 * POST /api/orders/[orderNo]/refresh
 * 公开 API：校验订单密码后，为 AUTO_FETCH 订单重新爬取账号密码。
 * 路由参数 orderId 实际传入的是 orderNo（人类可读订单号）。
 */
export async function POST(request: NextRequest, context: RouteContext) {
    // 路由段名为 orderId，但实际值是 orderNo（对外 URL 使用 orderNo）
    const { orderId: orderNo } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const { token } = (body as { token?: string }) ?? {}
    if (!token || typeof token !== "string") {
        return badRequest("缺少访问令牌")
    }
    if (!verifyOrderSuccessToken(orderNo, token)) {
        return badRequest("令牌无效或已过期，请重新查询订单")
    }

    // 查询订单（含产品类型 + 卡密）
    const order = await prisma.order.findUnique({
        where: { orderNo },
        include: {
            product: { select: { id: true, productType: true, sourceUrl: true, validityHours: true } },
            cards: {
                where: { status: "SOLD" },
                select: { id: true, content: true, lastRefreshedAt: true },
                take: 1,
            },
        },
    })

    if (!order) return notFound("订单不存在")

    // 类型检查
    if (order.product?.productType !== "AUTO_FETCH") {
        return badRequest("该订单类型不支持刷新")
    }

    // 状态检查
    if (order.status !== "COMPLETED") {
        return badRequest("订单未完成，无法刷新")
    }

    // 有效期检查
    if (order.expiresAt && order.expiresAt <= new Date()) {
        return NextResponse.json(
            { error: "订单已过期，请重新下单" },
            { status: 400 }
        )
    }

    // 刷新限流：同一订单 1 分钟内只能刷新一次
    const card = order.cards[0]
    if (!card) return badRequest("未找到对应卡密")

    if (card.lastRefreshedAt && Date.now() - card.lastRefreshedAt.getTime() < REFRESH_COOLDOWN_MS) {
        const secondsLeft = Math.ceil((REFRESH_COOLDOWN_MS - (Date.now() - card.lastRefreshedAt.getTime())) / 1000)
        return NextResponse.json(
            { error: `刷新过于频繁，请 ${secondsLeft} 秒后再试` },
            { status: 429 }
        )
    }

    // 爬取新账号
    const sourceUrl = (order.product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    if (!sourceUrl) {
        return badRequest("未配置爬取来源，无法刷新")
    }

    const [scrapedList, blacklisted] = await Promise.all([
        scrapeMultipleUrls(sourceUrl),
        prisma.accountBlacklist.findMany({
            where: {
                productId: order.product.id,
                OR: [
                    { reason: MANUAL_BLACKLIST_REASON },
                    { createdAt: { gt: new Date(Date.now() - config.blacklistExpiryHours * 60 * 60 * 1000) } },
                ],
            },
            select: { account: true },
        }),
    ])
    if (scrapedList.length === 0) {
        return NextResponse.json(
            {
                error: "当前无法获取新账号，旧数据仍有效",
                refreshed: false,
            },
            { status: 503 }
        )
    }
    const blackSet = new Set(blacklisted.map((b) => b.account))
    const available = scrapedList.filter((a) => !blackSet.has(a.account))
    if (available.length === 0) {
        return NextResponse.json(
            {
                error: "当前无法获取新账号，旧数据仍有效",
                refreshed: false,
            },
            { status: 503 }
        )
    }

    // 优先匹配原账号（若未被拉黑且在列表中则用新密码，否则换新号）
    let currentPayload: { account: string } | null = null
    try {
        const parsed = JSON.parse(card.content) as { account?: string }
        if (parsed?.account) currentPayload = { account: parsed.account }
    } catch {
        // ignore
    }

    const matchedAccount =
        currentPayload && !blackSet.has(currentPayload.account)
            ? available.find((a) => a.account === currentPayload!.account)
            : null
    const picked = matchedAccount ?? available[Math.floor(Math.random() * available.length)]
    const newPayload = sharedAccountToCardPayload(picked)
    const newContent = toCardContentJson(newPayload)

    // 更新卡密
    try {
        await prisma.card.update({
            where: { id: card.id },
            data: {
                content: newContent,
                lastRefreshedAt: new Date(),
            },
        })
    } catch (err) {
        console.error("[refresh] 更新卡密失败:", err)
        return internalServerError("刷新失败，请稍后重试")
    }

    return NextResponse.json({
        refreshed: true,
        accountChanged: !matchedAccount,
        payload: newPayload,
        refreshedAt: new Date().toISOString(),
    })
}

export const runtime = "nodejs"
