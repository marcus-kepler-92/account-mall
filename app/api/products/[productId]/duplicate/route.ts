import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound } from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ productId: string }>
}

/**
 * POST /api/products/[productId]/duplicate
 * Super admin only: duplicate a product (no cards copied).
 */
export async function POST(
    _request: NextRequest,
    context: RouteContext
) {
    const session = await getSuperAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const original = await prisma.product.findUnique({
        where: { id: productId },
        include: { tags: { select: { id: true } } },
    })
    if (!original) return notFound("Product not found")

    // Resolve unique slug: {slug}-copy, {slug}-copy-2, ...
    let candidateSlug = `${original.slug}-copy`
    let suffix = 2
    while (await prisma.product.findUnique({ where: { slug: candidateSlug } })) {
        candidateSlug = `${original.slug}-copy-${suffix}`
        suffix++
    }

    const maxSortOrder = await prisma.product.aggregate({ _max: { sortOrder: true } })
    const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1

    const newProduct = await prisma.product.create({
        data: {
            sortOrder: nextSortOrder,
            name: `${original.name} 副本`,
            slug: candidateSlug,
            status: "INACTIVE",
            description: original.description,
            summary: original.summary,
            image: original.image,
            price: original.price,
            maxQuantity: original.maxQuantity,
            productType: original.productType,
            sourceUrl: original.sourceUrl,
            validityHours: original.validityHours,
            allowAccountSwitch: original.allowAccountSwitch,
            accountSwitchLimit: original.accountSwitchLimit,
            riskWarningEnabled: original.riskWarningEnabled,
            riskWarningTitle: original.riskWarningTitle,
            riskWarningContent: original.riskWarningContent,
            riskWarningCountdown: original.riskWarningCountdown,
            riskWarningConfirmText: original.riskWarningConfirmText,
            purchaseLimitEnabled: original.purchaseLimitEnabled,
            purchaseLimitQuantity: original.purchaseLimitQuantity,
            commissionMode: original.commissionMode,
            commissionValue: original.commissionValue,
            tags: original.tags.length > 0
                ? { connect: original.tags.map((t) => ({ id: t.id })) }
                : undefined,
        },
    })

    return NextResponse.json({ id: newProduct.id }, { status: 201 })
}

export const runtime = "nodejs"
