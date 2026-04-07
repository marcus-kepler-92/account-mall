import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

// Only non-sensitive business config fields allowed in the system prompt.
// Never add API keys, secrets, or credentials here.
const promptConfig = {
    siteName: config.siteName,
    siteUrl: config.siteUrl,
    withdrawalMinAmount: config.withdrawalMinAmount,
    withdrawalFeePercent: config.withdrawalFeePercent,
    distributorInviteTtlDays: config.distributorInviteTtlDays,
    basePromoDiscountPercent: config.basePromoDiscountPercent,
    level2CommissionRatePercent: config.level2CommissionRatePercent,
}

/**
 * Build the system prompt for the distributor AI assistant.
 * Injects platform static rules and site URL from config.
 */
export function buildSystemPrompt(distributorName: string): string {
    return `你是${promptConfig.siteName}平台的 AI 助手，专门帮助分销员了解平台规则和业务操作。

当前用户：${distributorName}

## 平台静态规则
- 站点地址：${promptConfig.siteUrl}
- 提现最低金额：¥${promptConfig.withdrawalMinAmount}
- 提现手续费比例：${promptConfig.withdrawalFeePercent}%
- 邀请链接有效期：${promptConfig.distributorInviteTtlDays} 天
- 买家使用推荐码可享受 ${promptConfig.basePromoDiscountPercent}% 折扣（折扣成本从佣金中扣除）
- 二级佣金比例：团队成员佣金的 ${promptConfig.level2CommissionRatePercent}%

## 工具调用规则

根据用户**意图**判断，不要求字面匹配：

- **账户/推广/优惠码**：用户想了解自己的账号、推广方式、如何让买家享受折扣，或询问任何形式的"码"（推广码、优惠码、折扣码、邀请码、分享码）和分享链接 → 调用 get_my_profile
- **数据统计**：用户想查余额、可提现金额、收益、销售额、总收入、订单数等汇总数字 → 调用 get_my_stats
- **订单明细**：用户想看具体订单列表、历史成交记录 → 调用 get_my_orders
- **佣金明细**：用户想了解哪笔订单产生了多少佣金、佣金流水 → 调用 get_my_commissions
- **提现记录**：用户想查提现申请、打款状态、到账情况 → 调用 get_my_withdrawals
- **团队/下线**：用户想了解自己邀请的人、团队成员、下级分销员 → 调用 get_my_team
- **邀请记录**：用户想查发出的邀请、邀请进度、邀请链接 → 调用 get_my_invitations
- **佣金规则**：用户想了解佣金比例、阶梯规则、如何计算佣金 → 调用 get_commission_tiers
- **商品信息**：用户想了解平台在卖什么、商品列表、商品价格 → 调用 get_products
- **操作指南**：用户是新手、不知道怎么操作、想看教程 → 调用 get_guides
- **公告通知**：用户想看平台通知、最新公告、动态 → 调用 get_announcements

**推广码即优惠码**：get_my_profile 返回的 distributorCode 就是分销员的推广码，它既用于拼接分享链接（${promptConfig.siteUrl}/?ref=<推广码>），也是买家在下单页"优惠码"输入框里可以直接填写的那个码，两种用法的码值完全相同。

## 回答规范
- 使用中文，简洁友好
- 对新手耐心解释，避免行业术语
- 遇到无法解答的问题，引导用户联系平台客服

## 工具调用行为
- 需要调用工具时，**直接调用，不要在调用前输出任何文字**（不要说"我来帮你查"、"请稍等"等）
- 获得工具结果后再组织回复

## 严格禁止的行为（必须遵守）
- **禁止编造任何数字**：余额、佣金、订单金额等数据必须通过工具获取，工具未返回则明确说"暂无数据"
- **禁止推断或估算**：不要说"大概"、"应该是"、"通常"等模糊表述来替代真实数据
- **禁止凭空描述平台功能**：只能描述系统提示中已有的静态规则或工具返回的真实数据
- **禁止补全工具返回的空数据**：如果工具返回空列表，只说"暂无记录"，不要自行补充示例或说明
- **禁止描述平台状态**：不要说"平台目前没有发布..."、"平台尚未配置..."等评论性内容
- 如果用户问的问题超出你的知识范围，直接说"这个问题我无法确认，建议联系平台客服"`
}

/**
 * Build AI tool definitions for a specific distributor.
 * All "get_my_*" tools are scoped to distributorId — never trust AI-provided IDs.
 */
export function buildTools(distributorId: string) {
    return {
        get_my_profile: tool({
            description: "查询当前分销员的账户信息：推广码（即优惠码）、分享链接、折扣配置、上级邀请人",
            inputSchema: z.object({}),
            execute: async () => {
                const user = await prisma.user.findUnique({
                    where: { id: distributorId },
                    select: {
                        name: true,
                        email: true,
                        distributorCode: true,
                        discountCodeEnabled: true,
                        discountPercent: true,
                        inviter: { select: { name: true } },
                    },
                })
                if (!user) return { error: "用户不存在" }
                return {
                    name: user.name,
                    email: user.email,
                    distributorCode: user.distributorCode ?? null,
                    shareLink: user.distributorCode
                        ? `${config.siteUrl}/?ref=${user.distributorCode}`
                        : null,
                    discountEnabled: user.discountCodeEnabled,
                    discountPercent: user.discountPercent
                        ? Number(user.discountPercent).toFixed(2)
                        : null,
                    discountPercentNote: user.discountPercent
                        ? null
                        : user.discountCodeEnabled
                            ? "未单独设置，使用平台基础折扣比例"
                            : "优惠码已禁用，买家使用该码不享受折扣",
                    inviterName: user.inviter?.name ?? null,
                }
            },
        }),

        get_my_stats: tool({
            description: "查询当前分销员的可提现余额、累计佣金、本周销售额、订单数、团队人数",
            inputSchema: z.object({}),
            execute: async () => {
                const weekStart = new Date()
                weekStart.setDate(weekStart.getDate() - weekStart.getDay())
                weekStart.setHours(0, 0, 0, 0)

                const [l1, l2, paid, pending, orderCount, weekSales, teamCount] =
                    await Promise.all([
                        prisma.commission.aggregate({
                            where: { distributorId, level: 1, status: "SETTLED" },
                            _sum: { amount: true },
                        }),
                        prisma.commission.aggregate({
                            where: { distributorId, level: 2, status: "SETTLED" },
                            _sum: { amount: true },
                        }),
                        prisma.withdrawal.aggregate({
                            where: { distributorId, status: "PAID" },
                            _sum: { amount: true },
                        }),
                        prisma.withdrawal.aggregate({
                            where: { distributorId, status: "PENDING" },
                            _sum: { amount: true },
                        }),
                        prisma.order.count({ where: { distributorId } }),
                        prisma.order.aggregate({
                            where: {
                                distributorId,
                                status: "COMPLETED",
                                paidAt: { gte: weekStart },
                            },
                            _sum: { amount: true },
                        }),
                        prisma.user.count({ where: { inviterId: distributorId } }),
                    ])
                const level1 = Number(l1._sum.amount ?? 0)
                const level2 = Number(l2._sum.amount ?? 0)
                const paidAmt = Number(paid._sum.amount ?? 0)
                const pendingAmt = Number(pending._sum.amount ?? 0)
                return {
                    withdrawableBalance: (level1 + level2 - paidAmt - pendingAmt).toFixed(2),
                    level1EarnedTotal: level1.toFixed(2),
                    level2EarnedTotal: level2.toFixed(2),
                    pendingWithdrawal: pendingAmt.toFixed(2),
                    orderCount,
                    weekSalesAmount: Number(weekSales._sum.amount ?? 0).toFixed(2),
                    teamMemberCount: teamCount,
                }
            },
        }),

        get_my_orders: tool({
            description: "查询当前分销员最近的订单列表",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(20).default(10).describe("返回条数，最多 20"),
            }),
            execute: async ({ limit }) => {
                const orders = await prisma.order.findMany({
                    where: { distributorId },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    select: {
                        orderNo: true,
                        status: true,
                        amount: true,
                        quantity: true,
                        productNameSnapshot: true,
                        promoCode: true,
                        paidAt: true,
                        createdAt: true,
                    },
                })
                return orders.map((o) => ({
                    orderNo: o.orderNo,
                    status: o.status,
                    amount: Number(o.amount).toFixed(2),
                    quantity: o.quantity,
                    product: o.productNameSnapshot ?? "未知商品",
                    promoCode: o.promoCode ?? null,
                    paidAt: o.paidAt?.toISOString().slice(0, 10) ?? null,
                    date: o.createdAt.toISOString().slice(0, 10),
                }))
            },
        }),

        get_my_commissions: tool({
            description: "查询当前分销员最近的佣金记录",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(20).default(10),
            }),
            execute: async ({ limit }) => {
                const commissions = await prisma.commission.findMany({
                    where: { distributorId, status: { not: "CANCELLED" } },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    select: {
                        amount: true,
                        level: true,
                        status: true,
                        createdAt: true,
                        order: { select: { orderNo: true, productNameSnapshot: true } },
                    },
                })
                return commissions.map((c) => ({
                    amount: Number(c.amount).toFixed(2),
                    level: c.level,
                    status: c.status,
                    orderNo: c.order.orderNo,
                    product: c.order.productNameSnapshot ?? "未知商品",
                    date: c.createdAt.toISOString().slice(0, 10),
                }))
            },
        }),

        get_my_withdrawals: tool({
            description: "查询当前分销员的提现记录",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(20).default(10),
            }),
            execute: async ({ limit }) => {
                const withdrawals = await prisma.withdrawal.findMany({
                    where: { distributorId },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    select: {
                        amount: true,
                        status: true,
                        note: true,
                        feeAmount: true,
                        feePercent: true,
                        processedAt: true,
                        createdAt: true,
                    },
                })
                return withdrawals.map((w) => ({
                    amount: Number(w.amount).toFixed(2),
                    feePercent: w.feePercent ? Number(w.feePercent).toFixed(2) : null,
                    fee: w.feeAmount ? Number(w.feeAmount).toFixed(2) : null,
                    status: w.status,
                    note: w.note ?? null,
                    processedAt: w.processedAt?.toISOString().slice(0, 10) ?? null,
                    date: w.createdAt.toISOString().slice(0, 10),
                }))
            },
        }),

        get_my_team: tool({
            description: "查询当前分销员的团队成员（直属下线）列表及其产生的二级佣金",
            inputSchema: z.object({
                limit: z.number().int().min(1).max(50).default(20),
            }),
            execute: async ({ limit }) => {
                const members = await prisma.user.findMany({
                    where: { inviterId: distributorId },
                    orderBy: { createdAt: "desc" },
                    take: limit,
                    select: {
                        name: true,
                        createdAt: true,
                        commissions: {
                            where: { level: 2, distributorId },
                            select: { amount: true, status: true },
                        },
                    },
                })
                return members.map((m) => {
                    const settled = m.commissions
                        .filter((c) => c.status === "SETTLED" || c.status === "WITHDRAWN")
                        .reduce((sum, c) => sum + Number(c.amount), 0)
                    return {
                        name: m.name,
                        joinedAt: m.createdAt.toISOString().slice(0, 10),
                        level2CommissionEarned: settled.toFixed(2),
                    }
                })
            },
        }),

        get_my_invitations: tool({
            description: "查询当前分销员发出的邀请记录（邀请邮箱、有效期、是否已接受）",
            inputSchema: z.object({}),
            execute: async () => {
                const invitations = await prisma.distributorInvitation.findMany({
                    where: { inviterId: distributorId },
                    orderBy: { createdAt: "desc" },
                    take: 20,
                    select: {
                        email: true,
                        expiresAt: true,
                        acceptedAt: true,
                        createdAt: true,
                    },
                })
                const now = new Date()
                return invitations.map((inv) => ({
                    email: inv.email,
                    accepted: !!inv.acceptedAt,
                    acceptedAt: inv.acceptedAt?.toISOString().slice(0, 10) ?? null,
                    expired: !inv.acceptedAt && inv.expiresAt < now,
                    expiresAt: inv.expiresAt.toISOString().slice(0, 10),
                    sentAt: inv.createdAt.toISOString().slice(0, 10),
                }))
            },
        }),

        get_commission_tiers: tool({
            description: "查询平台佣金阶梯规则（不同销售额区间对应的佣金比例）",
            inputSchema: z.object({}),
            execute: async () => {
                const tiers = await prisma.commissionTier.findMany({
                    orderBy: { sortOrder: "asc" },
                    select: { minAmount: true, maxAmount: true, ratePercent: true },
                })
                return tiers.map((t) => ({
                    minAmount: Number(t.minAmount).toFixed(2),
                    maxAmount: Number(t.maxAmount).toFixed(2),
                    ratePercent: Number(t.ratePercent).toFixed(2),
                }))
            },
        }),

        get_products: tool({
            description: "查询平台当前在售商品列表（名称、价格、简介）",
            inputSchema: z.object({}),
            execute: async () => {
                const products = await prisma.product.findMany({
                    where: { status: "ACTIVE" },
                    orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
                    take: 30,
                    select: {
                        name: true,
                        price: true,
                        summary: true,
                        slug: true,
                        couponEnabled: true,
                    },
                })
                return products.map((p) => ({
                    name: p.name,
                    price: Number(p.price).toFixed(2),
                    summary: p.summary ?? null,
                    productUrl: `${config.siteUrl}/products/${p.slug}`,
                    couponEnabled: p.couponEnabled,
                }))
            },
        }),

        get_guides: tool({
            description: "查询平台入门指南内容，用于回答新人操作相关问题",
            inputSchema: z.object({}),
            execute: async () => {
                const guides = await prisma.distributorGuide.findMany({
                    where: { status: "PUBLISHED" },
                    orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }],
                    take: 20,
                    select: {
                        title: true,
                        content: true,
                        tag: { select: { name: true } },
                    },
                })
                return guides.map((g) => ({
                    title: g.title,
                    content: g.content,
                    category: g.tag?.name ?? null,
                }))
            },
        }),

        get_announcements: tool({
            description: "查询平台最新公告和通知",
            inputSchema: z.object({}),
            execute: async () => {
                const announcements = await prisma.announcement.findMany({
                    where: { status: "PUBLISHED" },
                    orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }],
                    take: 10,
                    select: {
                        title: true,
                        content: true,
                        publishedAt: true,
                    },
                })
                return announcements.map((a) => ({
                    title: a.title,
                    content: a.content ?? null,
                    publishedAt: a.publishedAt?.toISOString().slice(0, 10) ?? null,
                }))
            },
        }),
    }
}
