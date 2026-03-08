import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { z } from "zod"

const createTierSchema = z.object({
    minAmount: z.number().min(0),
    maxAmount: z.number().min(0),
    ratePercent: z.number().min(0).max(100),
    sortOrder: z.number().int().min(0).optional(),
})

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const tiers = await prisma.commissionTier.findMany({
        orderBy: { sortOrder: "asc" },
    })
    return NextResponse.json(
        tiers.map((t) => ({
            id: t.id,
            minAmount: Number(t.minAmount),
            maxAmount: Number(t.maxAmount),
            ratePercent: Number(t.ratePercent),
            sortOrder: t.sortOrder,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        }))
    )
}

export async function POST(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = createTierSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten())
    }

    const { minAmount, maxAmount, ratePercent, sortOrder } = parsed.data
    if (minAmount >= maxAmount) {
        return NextResponse.json(
            { error: "minAmount must be less than maxAmount" },
            { status: 400 }
        )
    }

    const maxSort = await prisma.commissionTier.aggregate({
        _max: { sortOrder: true },
    })
    const nextSort = (maxSort._max.sortOrder ?? -1) + 1

    const tier = await prisma.commissionTier.create({
        data: {
            minAmount,
            maxAmount,
            ratePercent,
            sortOrder: sortOrder ?? nextSort,
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
    }, { status: 201 })
}
