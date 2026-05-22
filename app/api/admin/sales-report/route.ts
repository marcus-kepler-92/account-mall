import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { resolveOrderCost } from "@/lib/profit"
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

export type SalesReportSeriesPoint = {
    date: string // YYYY-MM-DD (HKT calendar date)
    revenue: number
    cost: number
    profit: number
    quantity: number
    orderCount: number
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
    series: SalesReportSeriesPoint[]
}

const hktDateFormat = new Intl.DateTimeFormat("sv-SE", {
    timeZone: HKT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
})

function hktDateKey(d: Date): string {
    return hktDateFormat.format(d)
}

function enumerateDays(from: string, to: string): string[] {
    const result: string[] = []
    const [fy, fm, fd] = from.split("-").map(Number)
    const [ty, tm, td] = to.split("-").map(Number)
    const current = new Date(Date.UTC(fy, fm - 1, fd))
    const end = new Date(Date.UTC(ty, tm - 1, td))
    while (current <= end) {
        const y = current.getUTCFullYear()
        const m = String(current.getUTCMonth() + 1).padStart(2, "0")
        const d = String(current.getUTCDate()).padStart(2, "0")
        result.push(`${y}-${m}-${d}`)
        current.setUTCDate(current.getUTCDate() + 1)
    }
    return result
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

    const [orders, milestoneBonusRows] = await Promise.all([
        prisma.order.findMany({
            where: { status: "COMPLETED", paidAt: { gte: startUTC, lt: endUTC } },
            select: {
                id: true,
                productId: true,
                productNameSnapshot: true,
                quantity: true,
                amount: true,
                costSnapshot: true,
                costTotalSnapshot: true,
                paidAt: true,
                product: { select: { name: true } },
            },
        }),
        prisma.invitationMilestoneBonus.findMany({
            where: { createdAt: { gte: startUTC, lt: endUTC } },
            select: { amount: true, createdAt: true },
        }),
    ])

    const milestoneBonus = milestoneBonusRows.reduce(
        (s, r) => s + Number(r.amount),
        0,
    )
    const dayList = enumerateDays(from, to)

    if (orders.length === 0) {
        const emptySeries: SalesReportSeriesPoint[] = dayList.map((date) => {
            const dayBonus = milestoneBonusRows
                .filter((r) => hktDateKey(r.createdAt) === date)
                .reduce((s, r) => s + Number(r.amount), 0)
            return {
                date,
                revenue: 0,
                cost: 0,
                profit: -dayBonus,
                quantity: 0,
                orderCount: 0,
            }
        })
        return NextResponse.json<SalesReportResponse>({
            summary: { orderCount: 0, totalQuantity: 0, revenue: 0, cost: 0, milestoneBonus, profit: -milestoneBonus, hasMissingCost: false },
            products: [],
            series: emptySeries,
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

    // Aggregate by HKT day for time series
    type DayBucket = {
        revenue: number
        cost: number
        commission: number
        milestoneBonus: number
        quantity: number
        orderCount: number
    }
    const dayMap = new Map<string, DayBucket>()
    const ensureDay = (key: string): DayBucket => {
        let b = dayMap.get(key)
        if (!b) {
            b = { revenue: 0, cost: 0, commission: 0, milestoneBonus: 0, quantity: 0, orderCount: 0 }
            dayMap.set(key, b)
        }
        return b
    }

    for (const order of orders) {
        const existing = productMap.get(order.productId)
        const name = order.productNameSnapshot ?? order.product.name
        const revenue = Number(order.amount)
        const commission = commissionByOrder.get(order.id) ?? 0
        const { cost: orderCost, hasCost } = resolveOrderCost(order)
        const orderHasMissingCost = !hasCost

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

        if (order.paidAt) {
            const day = ensureDay(hktDateKey(order.paidAt))
            day.revenue += revenue
            day.commission += commission
            day.cost += orderCost
            day.quantity += order.quantity
            day.orderCount += 1
        }
    }

    for (const bonus of milestoneBonusRows) {
        const day = ensureDay(hktDateKey(bonus.createdAt))
        day.milestoneBonus += Number(bonus.amount)
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

    const series: SalesReportSeriesPoint[] = dayList.map((date) => {
        const b = dayMap.get(date)
        if (!b) {
            return { date, revenue: 0, cost: 0, profit: 0, quantity: 0, orderCount: 0 }
        }
        return {
            date,
            revenue: b.revenue,
            cost: b.cost,
            profit: b.revenue - b.cost - b.commission - b.milestoneBonus,
            quantity: b.quantity,
            orderCount: b.orderCount,
        }
    })

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
        series,
    })
}
