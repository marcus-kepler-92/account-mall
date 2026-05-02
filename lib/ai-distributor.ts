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

export interface DistributorContext {
    name: string
    email: string | null
    distributorCode: string | null
    shareLink: string | null
    discountEnabled: boolean
    discountPercent: string | null
    inviterName: string | null
    withdrawableBalance: string
    orderCount: number
    weekSalesAmount: string
    teamMemberCount: number
}

/**
 * Pre-fetch distributor profile and stats to inject into the system prompt.
 * Avoids tool calls for the most common "basic info" questions.
 */
export async function fetchDistributorContext(distributorId: string): Promise<DistributorContext | null> {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const [user, l1, l2, paid, pending, orderCount, weekSales, teamCount] = await Promise.all([
        prisma.user.findUnique({
            where: { id: distributorId },
            select: {
                name: true,
                email: true,
                distributorCode: true,
                discountCodeEnabled: true,
                discountPercent: true,
                inviter: { select: { name: true } },
            },
        }),
        prisma.commission.aggregate({ where: { distributorId, level: 1, status: "SETTLED" }, _sum: { amount: true } }),
        prisma.commission.aggregate({ where: { distributorId, level: 2, status: "SETTLED" }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { distributorId, status: "PAID" }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { distributorId, status: "PENDING" }, _sum: { amount: true } }),
        prisma.order.count({ where: { distributorId } }),
        prisma.order.aggregate({
            where: { distributorId, status: "COMPLETED", paidAt: { gte: weekStart } },
            _sum: { amount: true },
        }),
        prisma.user.count({ where: { inviterId: distributorId } }),
    ])

    if (!user) return null

    const level1 = Number(l1._sum.amount ?? 0)
    const level2 = Number(l2._sum.amount ?? 0)
    const paidAmt = Number(paid._sum.amount ?? 0)
    const pendingAmt = Number(pending._sum.amount ?? 0)

    return {
        name: user.name ?? "分销员",
        email: user.email,
        distributorCode: user.distributorCode ?? null,
        shareLink: user.distributorCode ? `${config.siteUrl}/?ref=${user.distributorCode}` : null,
        discountEnabled: user.discountCodeEnabled,
        discountPercent: user.discountPercent ? Number(user.discountPercent).toFixed(2) : null,
        inviterName: user.inviter?.name ?? null,
        withdrawableBalance: (level1 + level2 - paidAmt - pendingAmt).toFixed(2),
        orderCount,
        weekSalesAmount: Number(weekSales._sum.amount ?? 0).toFixed(2),
        teamMemberCount: teamCount,
    }
}

export interface PlatformContext {
    commissionTiers: Array<{ minAmount: string; maxAmount: string; ratePercent: string }>
    guides: Array<{ title: string; content: string | null; category: string | null }>
    announcements: Array<{ title: string; content: string | null; publishedAt: string | null }>
    products: Array<{ name: string; price: string; summary: string | null; productUrl: string }>
}

/**
 * Pre-fetch platform-wide data (commission tiers, guides, announcements, products).
 * These are injected into the system prompt to avoid tool calls for common questions.
 */
export async function fetchPlatformContext(): Promise<PlatformContext> {
    const [tiers, guides, announcements, products] = await Promise.all([
        prisma.commissionTier.findMany({
            orderBy: { sortOrder: "asc" },
            select: { minAmount: true, maxAmount: true, ratePercent: true },
        }),
        prisma.distributorGuide.findMany({
            where: { status: "PUBLISHED" },
            orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }],
            take: 20,
            select: { title: true, content: true, tag: { select: { name: true } } },
        }),
        prisma.announcement.findMany({
            where: { status: "PUBLISHED", audience: { in: ["DISTRIBUTOR", "ALL"] } },
            orderBy: [{ sortOrder: "desc" }, { publishedAt: "desc" }],
            take: 10,
            select: { title: true, content: true, publishedAt: true },
        }),
        prisma.product.findMany({
            where: { status: "ACTIVE" },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            take: 30,
            select: { name: true, price: true, summary: true, slug: true },
        }),
    ])

    return {
        commissionTiers: tiers.map((t) => ({
            minAmount: Number(t.minAmount).toFixed(2),
            maxAmount: Number(t.maxAmount).toFixed(2),
            ratePercent: Number(t.ratePercent).toFixed(2),
        })),
        guides: guides.map((g) => ({
            title: g.title,
            content: g.content,
            category: g.tag?.name ?? null,
        })),
        announcements: announcements.map((a) => ({
            title: a.title,
            content: a.content ?? null,
            publishedAt: a.publishedAt?.toISOString().slice(0, 10) ?? null,
        })),
        products: products.map((p) => ({
            name: p.name,
            price: Number(p.price).toFixed(2),
            summary: p.summary ?? null,
            productUrl: `${config.siteUrl}/products/${p.slug}`,
        })),
    }
}

function renderPlatformSection(platform: PlatformContext | null): string {
    if (!platform) return ""

    const tiersText =
        platform.commissionTiers.length === 0
            ? "暂无阶梯配置"
            : platform.commissionTiers
                  .map((t) => `  - 销售额 ¥${t.minAmount}～¥${t.maxAmount}：佣金比例 ${t.ratePercent}%`)
                  .join("\n")

    const guidesText =
        platform.guides.length === 0
            ? "暂无指南"
            : platform.guides
                  .map((g) => `### ${g.title}${g.category ? `（${g.category}）` : ""}\n${g.content ?? ""}`)
                  .join("\n\n")

    const announcementsText =
        platform.announcements.length === 0
            ? "暂无公告"
            : platform.announcements
                  .map((a) => `- **${a.title}**${a.publishedAt ? `（${a.publishedAt}）` : ""}${a.content ? `：${a.content}` : ""}`)
                  .join("\n")

    const productsText =
        platform.products.length === 0
            ? "暂无在售商品"
            : platform.products
                  .map((p) => `- ${p.name}：¥${p.price}${p.summary ? `，${p.summary}` : ""}（${p.productUrl}）`)
                  .join("\n")

    return `
## 佣金阶梯规则（已预加载，直接引用）
${tiersText}

## 在售商品（已预加载，直接引用）
${productsText}

## 平台公告（已预加载，直接引用）
${announcementsText}

## 操作指南（已预加载，直接引用）
${guidesText}`
}

/**
 * Build the system prompt for the distributor AI assistant.
 * Injects platform static rules, pre-fetched user context, and platform data.
 */
export function buildSystemPrompt(
    ctx: DistributorContext | null,
    platform: PlatformContext | null,
    fallbackName?: string,
): string {
    const name = ctx?.name ?? fallbackName ?? "分销员"

    const userSection = ctx
        ? `## 当前用户信息（已预加载，直接引用，无需调工具）
- 姓名：${ctx.name}
- 邮箱：${ctx.email ?? "（无邮箱账号）"}
- 推广码（即优惠码）：${ctx.distributorCode ?? "未设置"}
- 分享链接：${ctx.shareLink ?? "未设置"}
- 折扣码功能：${ctx.discountEnabled ? "已启用" : "已禁用"}${ctx.discountPercent ? `，折扣比例 ${ctx.discountPercent}%` : ""}
- 邀请人：${ctx.inviterName ?? "无"}
- 可提现余额：¥${ctx.withdrawableBalance}
- 累计带单数：${ctx.orderCount} 单
- 本周销售额：¥${ctx.weekSalesAmount}
- 团队人数：${ctx.teamMemberCount} 人`
        : `当前用户：${name}`

    return `你是${promptConfig.siteName}平台的 AI 助手，专门帮助分销员了解平台规则和业务操作。

${userSection}

## 平台静态规则
- 站点地址：${promptConfig.siteUrl}
- 提现最低金额：¥${promptConfig.withdrawalMinAmount}
- 提现手续费比例：${promptConfig.withdrawalFeePercent}%
- 邀请链接有效期：${promptConfig.distributorInviteTtlDays} 天
- 买家使用推荐码可享受 ${promptConfig.basePromoDiscountPercent}% 折扣（折扣成本从佣金中扣除）
- 二级佣金比例：团队成员佣金的 ${promptConfig.level2CommissionRatePercent}%
- 推广码即优惠码：分享链接格式为 ${promptConfig.siteUrl}/?ref=<推广码>，推广码也可直接填入下单页"优惠码"输入框
${renderPlatformSection(platform)}
## 工具调用规则

以下数据**已预加载在上方**，直接引用，**不要再调工具**：
- 用户基本信息、余额、订单数、团队人数 → 已在"当前用户信息"中
- 佣金阶梯规则 → 已在"佣金阶梯规则"中
- 在售商品列表 → 已在"在售商品"中
- 平台公告 → 已在"平台公告"中
- 操作指南 → 已在"操作指南"中

以下数据**需要调工具实时查询**，根据用户**意图**判断（不要求字面匹配）：
- **订单明细**：用户想看具体订单列表、历史成交记录、某笔订单详情 → 调用 get_my_orders
- **佣金明细**：用户想了解哪笔订单产生了多少佣金、佣金流水 → 调用 get_my_commissions
- **提现记录**：用户想查提现申请、打款状态、到账情况 → 调用 get_my_withdrawals
- **团队成员详情**：用户想看下线名单、每个成员带来的二级佣金 → 调用 get_my_team
- **邀请记录**：用户想查发出的邀请、邀请进度 → 调用 get_my_invitations

需要调工具时，**直接调用，不要在调用前输出任何文字**（不要说"我来帮你查"、"请稍等"等）。

## 回答规范
- 使用中文，简洁友好
- 对新手耐心解释，避免行业术语
- 遇到无法解答的问题，引导用户联系平台客服

## 严格禁止的行为（必须遵守）
- **禁止编造任何数字**：工具未返回的数据明确说"暂无数据"
- **禁止推断或估算**：不要说"大概"、"应该是"、"通常"等模糊表述来替代真实数据
- **禁止凭空描述平台功能**：只能描述系统提示中已有的内容或工具返回的真实数据
- **禁止补全工具返回的空数据**：如果工具返回空列表，只说"暂无记录"
- **禁止描述平台状态**：不要说"平台目前没有发布..."、"平台尚未配置..."等评论性内容
- 如果用户问的问题超出你的知识范围，直接说"这个问题我无法确认，建议联系平台客服"`
}

/**
 * Build AI tool definitions for a specific distributor.
 * All "get_my_*" tools are scoped to distributorId — never trust AI-provided IDs.
 */
export function buildTools(distributorId: string) {
    return {
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

    }
}
