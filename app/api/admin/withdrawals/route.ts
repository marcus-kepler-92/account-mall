import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

export async function GET(request: NextRequest) {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") as "PENDING" | "PAID" | "REJECTED" | null

    const where: { status?: "PENDING" | "PAID" | "REJECTED" } = {}
    if (status === "PENDING" || status === "PAID" || status === "REJECTED") {
        where.status = status
    }

    const withdrawals = await prisma.withdrawal.findMany({
        where,
        include: {
            distributor: {
                select: { id: true, email: true, name: true },
            },
        },
        orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(
        withdrawals.map((w) => ({
            id: w.id,
            distributorId: w.distributorId,
            distributor: w.distributor,
            amount: Number(w.amount),
            status: w.status,
            note: w.note,
            receiptImageUrl: w.receiptImageUrl,
            processedAt: w.processedAt,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
        }))
    )
}
