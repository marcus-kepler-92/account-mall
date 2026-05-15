import { resolve } from "path"
import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

// Playwright workers 不自动加载 .env，手动加载项目根目录的 .env
loadEnv({ path: resolve(process.cwd(), ".env"), override: false })

function buildConnectionString(): string {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL
    const user = process.env.POSTGRES_USER ?? ""
    const password = process.env.POSTGRES_PASSWORD ?? ""
    const host = process.env.POSTGRES_HOST ?? "localhost"
    const port = process.env.POSTGRES_PORT ?? "5432"
    const db = process.env.POSTGRES_DB ?? ""
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}`
}

const adapter = new PrismaPg({ connectionString: buildConnectionString() })
const prisma = new PrismaClient({ adapter })

export type TestProduct = {
    id: string
    slug: string
    path: string
}

/**
 * 创建 E2E 测试专用商品和卡密。
 * 每个测试文件应在 beforeAll 中调用，传入唯一 slug。
 *
 * `cardUnitCost` (optional): persisted on every UNSOLD card created here. Use this in
 * cost/profit related E2E flows to assert that costTotalSnapshot aggregates correctly
 * once an order completes.
 */
export async function createTestProduct(opts: {
    slug: string
    name: string
    price?: number
    maxQuantity?: number
    cardCount: number
    cardUnitCost?: number | null
}): Promise<TestProduct> {
    const { slug, name, price = 0.01, maxQuantity = 5, cardCount, cardUnitCost = null } = opts

    // 幂等：已存在则复用
    let product = await prisma.product.findUnique({ where: { slug } })
    if (!product) {
        product = await prisma.product.create({
            data: { name, slug, description: `E2E test: ${name}`, price, maxQuantity, status: "ACTIVE" },
        })
    }

    // 精确控制 UNSOLD 卡数量
    const unsold = await prisma.card.count({
        where: { productId: product.id, status: "UNSOLD" },
    })
    if (unsold > cardCount) {
        const excess = await prisma.card.findMany({
            where: { productId: product.id, status: "UNSOLD" },
            select: { id: true },
            take: unsold - cardCount,
        })
        await prisma.card.deleteMany({ where: { id: { in: excess.map((c) => c.id) } } })
    } else if (unsold < cardCount) {
        const need = cardCount - unsold
        await prisma.card.createMany({
            data: Array.from({ length: need }, (_, i) => ({
                productId: product!.id,
                content: `${slug}-card-${Date.now()}-${i}`,
                status: "UNSOLD" as const,
                unitCost: cardUnitCost,
            })),
        })
    }

    return { id: product.id, slug: product.slug, path: `/products/${product.id}-${product.slug}` }
}

/**
 * Fetch an order's authoritative cost snapshot fields. Used by cost-tracking E2E
 * assertions to verify completePendingOrder's aggregation.
 */
export async function getOrderCostSnapshot(orderNo: string): Promise<{
    costTotalSnapshot: number | null
    costSnapshot: number | null
    status: string
} | null> {
    const order = await prisma.order.findFirst({
        where: { orderNo },
        select: { costTotalSnapshot: true, costSnapshot: true, status: true },
    })
    if (!order) return null
    return {
        costTotalSnapshot: order.costTotalSnapshot == null ? null : Number(order.costTotalSnapshot),
        costSnapshot: order.costSnapshot == null ? null : Number(order.costSnapshot),
        status: order.status,
    }
}

/**
 * 清理测试商品产生的订单和卡密，恢复到初始状态。
 * 每个测试文件应在 afterAll 中调用。
 */
export async function cleanupTestProduct(productId: string, cardCount: number) {
    // 关闭该商品的所有 PENDING 订单，释放卡
    const pendingOrders = await prisma.order.findMany({
        where: { productId, status: "PENDING" },
        select: { id: true },
    })
    if (pendingOrders.length > 0) {
        const ids = pendingOrders.map((o) => o.id)
        await prisma.$transaction([
            prisma.card.updateMany({
                where: { orderId: { in: ids } },
                data: { status: "UNSOLD", orderId: null },
            }),
            prisma.order.updateMany({
                where: { id: { in: ids } },
                data: { status: "CLOSED" },
            }),
        ])
    }

    // 清理已完成的订单产生的 SOLD/RESERVED 卡 → 删除，然后补充 UNSOLD 卡到目标数量
    await prisma.card.deleteMany({
        where: { productId, status: { in: ["SOLD", "RESERVED"] } },
    })

    // 确保 UNSOLD 卡精确到目标数量
    const unsold = await prisma.card.count({
        where: { productId, status: "UNSOLD" },
    })
    if (unsold > cardCount) {
        const excess = await prisma.card.findMany({
            where: { productId, status: "UNSOLD" },
            select: { id: true },
            take: unsold - cardCount,
        })
        await prisma.card.deleteMany({ where: { id: { in: excess.map((c) => c.id) } } })
    } else if (unsold < cardCount) {
        const need = cardCount - unsold
        await prisma.card.createMany({
            data: Array.from({ length: need }, (_, i) => ({
                productId,
                content: `cleanup-card-${Date.now()}-${i}`,
                status: "UNSOLD" as const,
            })),
        })
    }

    // 清理 exit discount 使用记录
    await prisma.exitDiscountUsage.deleteMany({ where: { productId } })
}

/**
 * 清理测试中创建的订单（按邮箱匹配）。
 */
export async function cleanupOrdersByEmail(email: string) {
    const orders = await prisma.order.findMany({
        where: { email },
        select: { id: true },
    })
    if (orders.length === 0) return

    const ids = orders.map((o) => o.id)
    await prisma.$transaction([
        prisma.card.updateMany({
            where: { orderId: { in: ids } },
            data: { status: "UNSOLD", orderId: null },
        }),
        prisma.exitDiscountUsage.deleteMany({ where: { orderId: { in: ids } } }),
        prisma.commission.deleteMany({ where: { orderId: { in: ids } } }),
        prisma.order.deleteMany({ where: { id: { in: ids } } }),
    ])
}

export async function disconnectPrisma() {
    await prisma.$disconnect()
}
