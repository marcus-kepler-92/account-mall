import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, badRequest, invalidJsonBody } from "@/lib/api-response"
import { MANUAL_BLACKLIST_REASON } from "@/lib/auto-fetch-card"

type RouteContext = { params: Promise<{ productId: string }> }

/**
 * POST /api/admin/products/[productId]/blacklist/toggle
 * Admin: toggle blacklist status for an account.
 * If blacklisted → removes entry. If not → creates entry.
 * Body: { account: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    let body: { account?: string }
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const { account } = body
    if (!account || typeof account !== "string") return badRequest("缺少账号")

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
    })
    if (!product) return notFound("商品不存在")

    const existing = await prisma.accountBlacklist.findUnique({
        where: { productId_account: { productId, account } },
    })

    if (existing) {
        await prisma.accountBlacklist.delete({ where: { id: existing.id } })
        return NextResponse.json({ isBlacklisted: false })
    } else {
        await prisma.accountBlacklist.create({
            data: { productId, account, reason: MANUAL_BLACKLIST_REASON },
        })
        return NextResponse.json({ isBlacklisted: true })
    }
}
