import { tool } from "ai"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"

/**
 * Build the system prompt for the distributor AI assistant.
 * Injects platform static rules from config.
 */
export function buildSystemPrompt(distributorName: string): string {
    return `你是${config.siteName}平台的 AI 助手，专门帮助分销员了解平台规则和业务操作。

当前用户：${distributorName}

## 平台静态规则
- 提现最低金额：¥${config.withdrawalMinAmount}
- 提现手续费比例：${config.withdrawalFeePercent}%
- 邀请链接有效期：${config.distributorInviteTtlDays} 天
- 买家使用推荐码可享受 ${config.basePromoDiscountPercent}% 折扣（折扣成本从佣金中扣除）
- 二级佣金比例：团队成员佣金的 ${config.level2CommissionRatePercent}%

## 回答规范
- 使用中文，简洁友好
- 对新手耐心解释，避免行业术语
- 查询实时数据时调用工具，不要编造数字
- 遇到无法解答的问题，引导用户联系平台客服`
}

/**
 * Build AI tool definitions for a specific distributor.
 * All "get_my_*" tools are scoped to distributorId — never trust AI-provided IDs.
 */
export function buildTools(distributorId: string) {
    return {
        get_my_stats: tool({
            description: "查询当前分销员的可提现余额、累计推广佣金、累计团队佣金、历史订单总数",
            inputSchema: z.object({}),
            execute: async () => {
                const [l1, l2, paid, pending, orderCount] = await Promise.all([
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
                        productNameSnapshot: true,
                        createdAt: true,
                    },
                })
                return orders.map((o) => ({
                    orderNo: o.orderNo,
                    status: o.status,
                    amount: Number(o.amount).toFixed(2),
                    product: o.productNameSnapshot ?? "未知商品",
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
                    select: { amount: true, level: true, status: true, createdAt: true },
                })
                return commissions.map((c) => ({
                    amount: Number(c.amount).toFixed(2),
                    level: c.level,
                    status: c.status,
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
                    select: { amount: true, status: true, note: true, feeAmount: true, createdAt: true },
                })
                return withdrawals.map((w) => ({
                    amount: Number(w.amount).toFixed(2),
                    fee: w.feeAmount ? Number(w.feeAmount).toFixed(2) : null,
                    status: w.status,
                    note: w.note ?? null,
                    date: w.createdAt.toISOString().slice(0, 10),
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
                    select: { name: true, price: true, summary: true },
                })
                return products.map((p) => ({
                    name: p.name,
                    price: Number(p.price).toFixed(2),
                    summary: p.summary ?? null,
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
    }
}
