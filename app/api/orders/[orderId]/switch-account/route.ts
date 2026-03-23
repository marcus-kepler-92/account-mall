import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyPassword } from "better-auth/crypto"
import { scrapeSharedAccounts } from "@/lib/scrape-shared-accounts"
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
 * 公开 API：AUTO_FETCH 订单一次性换号。用户标记当前账号不可用，旧账号加入该商品黑名单，重新分配新账号。
 * 路由参数 orderId 实际传入的是 orderNo（人类可读订单号）。
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const { orderId: orderNo } = await context.params

    let body: { password?: string }
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const { password } = body
    if (!password) return badRequest("缺少订单密码")

    const order = await prisma.order.findUnique({
        where: { orderNo },
        include: {
            product: { select: { id: true, productType: true, sourceUrl: true, validityHours: true } },
            cards: {
                where: { status: "SOLD" },
                select: { id: true, content: true },
                take: 1,
            },
        },
    })

    if (!order) return notFound("订单不存在")

    if (!(await verifyPassword({ hash: order.passwordHash, password }))) {
        return badRequest("订单密码错误")
    }

    if (order.product?.productType !== "AUTO_FETCH") {
        return badRequest("仅 AUTO_FETCH 商品支持账号切换")
    }

    if (order.status !== "COMPLETED") {
        return badRequest("订单未完成，无法切换账号")
    }

    if (order.expiresAt && order.expiresAt <= new Date()) {
        return badRequest("订单已过期，请重新下单")
    }

    if (order.hasSwitchedAccount) {
        return badRequest("每个订单只能切换账号一次")
    }

    const card = order.cards[0]
    if (!card) return badRequest("未找到关联卡密")

    const sourceUrl = (order.product.sourceUrl?.trim() || config.autoFetchSourceUrls[0]?.trim()) ?? ""
    if (!sourceUrl) return badRequest("未配置爬取来源，无法切换账号")

    const scrapedList = await scrapeSharedAccounts(sourceUrl)
    if (scrapedList.length === 0) {
        return NextResponse.json({ error: "当前无可用账号，请稍后再试" }, { status: 503 })
    }

    const currentPayload = parseAutoFetchCardContent(card.content)
    const currentAccount = currentPayload?.account ?? null

    // 过滤：黑名单 + 当前账号
    const blacklisted = await prisma.accountBlacklist.findMany({
        where: { productId: order.product.id },
        select: { account: true },
    })
    const blackSet = new Set(blacklisted.map((b) => b.account))
    const available = scrapedList.filter(
        (a) => !blackSet.has(a.account) && a.account !== currentAccount
    )

    if (available.length === 0) {
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
        // 标记订单已切换
        prisma.order.update({
            where: { id: order.id, hasSwitchedAccount: false },
            data: { hasSwitchedAccount: true },
        }),
    ])

    return NextResponse.json({ switched: true, payload: newPayload })
}
