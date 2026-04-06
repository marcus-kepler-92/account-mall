import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/**
 * Build the system prompt for the distributor AI assistant.
 * Injects platform static rules and site URL from config.
 */
export function buildSystemPrompt(distributorName: string): string {
    return `你是${config.siteName}平台的 AI 助手，专门帮助分销员了解平台规则和业务操作。

当前用户：${distributorName}

## 平台静态规则
- 站点地址：${config.siteUrl}
- 提现最低金额：¥${config.withdrawalMinAmount}
- 提现手续费比例：${config.withdrawalFeePercent}%
- 邀请链接有效期：${config.distributorInviteTtlDays} 天
- 买家使用推荐码可享受 ${config.basePromoDiscountPercent}% 折扣（折扣成本从佣金中扣除）
- 二级佣金比例：团队成员佣金的 ${config.level2CommissionRatePercent}%

## 工具调用规则
- 用户询问自己的账户信息、推广码、分享链接时 → 调用 get_my_profile
- 用户询问余额、收益、订单数量等统计数据时 → 调用 get_my_stats
- 用户询问自己的订单列表时 → 调用 get_my_orders
- 用户询问佣金记录时 → 调用 get_my_commissions
- 用户询问提现记录或提现状态时 → 调用 get_my_withdrawals
- 用户询问团队成员、下线时 → 调用 get_my_team
- 用户询问邀请记录、邀请进度时 → 调用 get_my_invitations
- 用户询问佣金阶梯规则时 → 调用 get_commission_tiers
- 用户询问平台商品、在售商品时 → 调用 get_products
- 用户询问操作指南、新手教程时 → 调用 get_guides
- 用户询问平台公告、通知时 → 调用 get_announcements
- 分享链接 = ${config.siteUrl}/?ref=<分销员推广码>，通过 get_my_profile 获取推广码后拼接

## 回答规范
- 使用中文，简洁友好
- 对新手耐心解释，避免行业术语
- 遇到无法解答的问题，引导用户联系平台客服

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
            description: "查询当前分销员的账户信息：推广码、分享链接、折扣配置、上级邀请人",
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
                    discountCodeEnabled: user.discountCodeEnabled,
                    discountPercent: user.discountPercent
                        ? Number(user.discountPercent).toFixed(2)
                        : null,
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
