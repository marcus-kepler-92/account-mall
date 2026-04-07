import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { updatePaymentChannelSchema } from "@/lib/validations/payment-channel"

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

    const parsed = updatePaymentChannelSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const existing = await prisma.paymentChannel.findUnique({ where: { id } })
    if (!existing) return notFound("渠道不存在")

    const updated = await prisma.paymentChannel.update({
        where: { id },
        data: parsed.data,
    })
    return NextResponse.json({ data: updated })
}
