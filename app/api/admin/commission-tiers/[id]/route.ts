import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { z } from "zod"

const updateTierSchema = z.object({
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    ratePercent: z.number().min(0).max(100).optional(),
    sortOrder: z.number().int().min(0).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = updateTierSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const existing = await prisma.commissionTier.findUnique({ where: { id } })
    if (!existing) return notFound("Tier not found")

    const data = parsed.data
    if (data.minAmount != null && data.maxAmount != null && data.minAmount >= data.maxAmount) {
        return NextResponse.json(
            { error: "minAmount must be less than maxAmount" },
            { status: 400 }
        )
    }

    const tier = await prisma.commissionTier.update({
        where: { id },
        data: {
            ...(data.minAmount != null && { minAmount: data.minAmount }),
            ...(data.maxAmount != null && { maxAmount: data.maxAmount }),
            ...(data.ratePercent != null && { ratePercent: data.ratePercent }),
            ...(data.sortOrder != null && { sortOrder: data.sortOrder }),
        },
    })

    return NextResponse.json({
        id: tier.id,
        minAmount: Number(tier.minAmount),
        maxAmount: Number(tier.maxAmount),
        ratePercent: Number(tier.ratePercent),
        sortOrder: tier.sortOrder,
        createdAt: tier.createdAt,
        updatedAt: tier.updatedAt,
    })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { id } = await context.params

    const existing = await prisma.commissionTier.findUnique({ where: { id } })
    if (!existing) return notFound("Tier not found")

    await prisma.commissionTier.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
}
