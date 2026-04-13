import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized } from "@/lib/api-response"

export async function GET() {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const pending = await prisma.withdrawal.count({ where: { status: "PENDING" } })
    return NextResponse.json({ pending })
}
