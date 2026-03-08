import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound } from "@/lib/api-response"
import { z } from "zod"

const updateWithdrawalSchema = z.object({
    status: z.enum(["PAID", "REJECTED"]),
    note: z.string().optional(),
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

    const parsed = updateWithdrawalSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        )
    }

    const existing = await prisma.withdrawal.findUnique({ where: { id } })
    if (!existing) return notFound("Withdrawal not found")
    if (existing.status !== "PENDING") {
        return NextResponse.json(
            { error: "Only PENDING withdrawals can be updated" },
            { status: 400 }
        )
    }

    const withdrawal = await prisma.withdrawal.update({
        where: { id },
        data: {
            status: parsed.data.status,
            ...(parsed.data.note !== undefined && { note: parsed.data.note }),
            processedAt: new Date(),
        },
        include: {
            distributor: {
                select: { id: true, email: true, name: true },
            },
        },
    })

    return NextResponse.json({
        id: withdrawal.id,
        distributorId: withdrawal.distributorId,
        distributor: withdrawal.distributor,
        amount: Number(withdrawal.amount),
        status: withdrawal.status,
        note: withdrawal.note,
        processedAt: withdrawal.processedAt,
        createdAt: withdrawal.createdAt,
        updatedAt: withdrawal.updatedAt,
    })
}
