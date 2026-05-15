import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { fromZonedTime } from "date-fns-tz"

const HKT = "Asia/Hong_Kong"
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidCalendarDate(y: number, m: number, d: number): boolean {
    const date = new Date(y, m - 1, d)
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function parseHKTRange(
    fy: number, fm: number, fd: number,
    ty: number, tm: number, td: number,
): { startUTC: Date; endUTC: Date } {
    const startUTC = fromZonedTime(new Date(fy, fm - 1, fd, 0, 0, 0, 0), HKT)
    // next day 00:00 HKT → exclusive upper bound
    const endUTC = fromZonedTime(new Date(ty, tm - 1, td + 1, 0, 0, 0, 0), HKT)
    return { startUTC, endUTC }
}

export type SalesReportProduct = {
    productId: string
    productName: string
    quantity: number
    avgPrice: number
    revenue: number
    commission: number
    cost: number
    profit: number
    margin: number
    hasMissingCost: boolean
}

export type SalesReportResponse = {
    summary: {
        orderCount: number
        totalQuantity: number
        revenue: number
        cost: number
        milestoneBonus: number
        profit: number
        hasMissingCost: boolean
    }
    products: SalesReportProduct[]
}

export async function GET(request: Request): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") ?? ""
    const to = searchParams.get("to") ?? ""

    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
        return badRequest("from and to must be YYYY-MM-DD")
    }
    if (from > to) {
        return badRequest("from must not be after to")
    }

    const [fy, fm, fd] = from.split("-").map(Number)
    const [ty, tm, td] = to.split("-").map(Number)
    if (!isValidCalendarDate(fy, fm, fd) || !isValidCalendarDate(ty, tm, td)) {
        return badRequest("from and to must be valid calendar dates")
    }

    const { startUTC, endUTC } = parseHKTRange(fy, fm, fd, ty, tm, td)

    const [orders, milestoneBonusRow] = await Promise.all([
        prisma.order.findMany({
            where: { status: "COMPLETED", paidAt: { gte: startUTC, lt: endUTC } },
            select: {
                id: true,
                productId: true,
                productNameSnapshot: true,
                quantity: true,
                amount: true,
                costSnapshot: true,
                product: { select: { name: true } },
            },
        }),
        prisma.invitationMilestoneBonus.aggregate({
            where: { createdAt: { gte: startUTC, lt: endUTC } },
            _sum: { amount: true },
        }),
    ])

    const milestoneBonus = Number(milestoneBonusRow._sum.amount ?? 0)

    if (orders.length === 0) {
        return NextResponse.json<SalesReportResponse>({
            summary: { orderCount: 0, totalQuantity: 0, revenue: 0, cost: 0, milestoneBonus, profit: 0, hasMissingCost: false },
            products: [],
        })
    }

    const orderIds = orders.map((o) => o.id)
    const commissionRows = await prisma.commission.groupBy({
        by: ["orderId"],
        where: { orderId: { in: orderIds }, status: { not: "CANCELLED" } },
        _sum: { amount: true },
    })

    const commissionByOrder = new Map<string, number>()
    for (const row of commissionRows) {
        commissionByOrder.set(row.orderId, Number(row._sum.amount ?? 0))
    }

    // Aggregate by product
    const productMap = new Map<
        string,
        { productName: string; quantity: number; revenue: number; commission: number; cost: number; hasMissingCost: boolean }
    >()

    for (const order of orders) {
        const existing = productMap.get(order.productId)
        const name = order.productNameSnapshot ?? order.product.name
        const revenue = Number(order.amount)
        const commission = commissionByOrder.get(order.id) ?? 0
        const orderCost = order.costSnapshot !== null
            ? Number(order.costSnapshot) * order.quantity
            : 0
        const orderHasMissingCost = order.costSnapshot === null

        if (existing) {
            existing.quantity += order.quantity
            existing.revenue += revenue
            existing.commission += commission
            existing.cost += orderCost
            if (orderHasMissingCost) existing.hasMissingCost = true
        } else {
            productMap.set(order.productId, {
                productName: name,
                quantity: order.quantity,
                revenue,
                commission,
                cost: orderCost,
                hasMissingCost: orderHasMissingCost,
            })
        }
    }

    const products: SalesReportProduct[] = Array.from(productMap.entries())
        .map(([productId, data]) => {
            const profit = data.revenue - data.commission - data.cost
            return {
                productId,
                productName: data.productName,
                quantity: data.quantity,
                avgPrice: data.quantity > 0 ? data.revenue / data.quantity : 0,
                revenue: data.revenue,
                commission: data.commission,
                cost: data.cost,
                profit,
                margin: data.revenue > 0 ? profit / data.revenue : 0,
                hasMissingCost: data.hasMissingCost,
            }
        })
        .sort((a, b) => b.profit - a.profit)

    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0)
    const totalCommission = products.reduce((s, p) => s + p.commission, 0)
    const totalCost = products.reduce((s, p) => s + p.cost, 0)
    const hasMissingCost = products.some((p) => p.hasMissingCost)

    return NextResponse.json<SalesReportResponse>({
        summary: {
            orderCount: orders.length,
            totalQuantity: products.reduce((s, p) => s + p.quantity, 0),
            revenue: totalRevenue,
            cost: totalCost,
            milestoneBonus,
            profit: totalRevenue - totalCommission - totalCost - milestoneBonus,
            hasMissingCost,
        },
        products,
    })
}
