import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyOrderSuccessToken } from "@/lib/order-success-token"
import { scrapeMultipleUrls } from "@/lib/scrape-shared-accounts"
import {
    parseAutoFetchCardContent,
    sharedAccountToCardPayload,
    toCardContentJson,
} from "@/lib/auto-fetch-card"
import { config } from "@/lib/config"
import { badRequest, notFound, invalidJsonBody } from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ orderId: string }>
}

/**
 * POST /api/orders/[orderNo]/switch-account
 * 公开 API：AUTO_FETCH 订单换号。用户标记当前账号不可用，旧账号加入该商品黑名单，重新分配新账号。
 * 鉴权：验证 successToken（由订单查询时密码验证后生成，无需二次输入密码）。
 * 路由参数 orderId 实际传入的是 orderNo（人类可读订单号）。
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const { orderId: orderNo } = await context.params

    let body: { token?: string }
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const { token } = body
    if (!token) return badRequest("缺少访问令牌")
    if (!verifyOrderSuccessToken(orderNo, token)) return badRequest("令牌无效或已过期，请重新查询订单")

    const order = await prisma.order.findUnique({
        where: { orderNo },
        include: {
            product: {
                select: {
                    id: true,
                    productType: true,
                    sourceUrl: true,
                    validityHours: true,
                    allowAccountSwitch: true,
                    accountSwitchLimit: true,
                },
            },
            cards: {
                where: { status: "SOLD" },
                select: { id: true, content: true },
                take: 1,
            },
        },
    })

    if (!order) return notFound("订单不存在")

    if (order.product?.productType !== "AUTO_FETCH") {
        return badRequest("仅 AUTO_FETCH 商品支持账号切换")
    }

    if (!order.product.allowAccountSwitch) {
        return badRequest("该商品未启用账号更换功能")
    }

    if (order.status !== "COMPLETED") {
        return badRequest("订单未完成，无法切换账号")
    }

    if (order.expiresAt && order.expiresAt <= new Date()) {
        return badRequest("订单已过期，请重新下单")
    }

    if (order.switchAccountCount >= order.product.accountSwitchLimit) {
        return badRequest(
            order.product.accountSwitchLimit === 1
                ? "每个订单只能切换账号一次"
                : `已达到最大更换次数（${order.product.accountSwitchLimit} 次）`
        )
    }

    const card = order.cards[0]
    if (!card) return badRequest("未找到关联卡密")

    const sourceUrl = (order.product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    if (!sourceUrl) return badRequest("未配置爬取来源，无法切换账号")

    const currentPayload = parseAutoFetchCardContent(card.content)
    const currentAccount = currentPayload?.account ?? null

    const [scrapedList, blacklisted] = await Promise.all([
        scrapeMultipleUrls(sourceUrl),
        prisma.accountBlacklist.findMany({
            where: { productId: order.product.id },
            select: { account: true },
        }),
    ])
    if (scrapedList.length === 0) {
        console.warn(`[switch-account] 爬取返回空列表，订单: ${orderNo}，来源: ${sourceUrl}`)
        return NextResponse.json({ error: "当前无可用账号，请稍后再试" }, { status: 503 })
    }
    const blackSet = new Set(blacklisted.map((b) => b.account))
    const available = scrapedList.filter(
        (a) => !blackSet.has(a.account) && a.account !== currentAccount
    )

    if (available.length === 0) {
        console.warn(`[switch-account] 无可用备用账号，订单: ${orderNo}，共 ${scrapedList.length} 条，黑名单 ${blacklisted.length} 条，当前账号: ${currentAccount}`)
        return NextResponse.json({ error: "当前无其他可用账号，请稍后再试" }, { status: 503 })
    }

    const picked = available[Math.floor(Math.random() * available.length)]
    const newPayload = sharedAccountToCardPayload(picked)
    const newContent = toCardContentJson(newPayload)
    const now = new Date()

    await prisma.$transaction([
        // 将旧账号加入黑名单
        ...(currentAccount
            ? [
                  prisma.accountBlacklist.upsert({
                      where: { productId_account: { productId: order.product.id, account: currentAccount } },
                      create: {
                          productId: order.product.id,
                          account: currentAccount,
                          reason: "用户标记不可用",
                          orderId: order.id,
                      },
                      update: {},
                  }),
              ]
            : []),
        // 更新卡密内容
        prisma.card.update({
            where: { id: card.id },
            data: { content: newContent, lastRefreshedAt: now },
        }),
        // 递增换号计数
        prisma.order.update({
            where: { id: order.id },
            data: { switchAccountCount: { increment: 1 } },
        }),
    ])

    return NextResponse.json({ switched: true, payload: newPayload })
}
