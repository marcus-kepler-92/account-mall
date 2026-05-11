import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { crossSellSettingSchema } from "@/lib/validations/cross-sell"
import { getCrossSellSetting } from "@/lib/cross-sell"

export async function GET(_request: NextRequest): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const settings = await getCrossSellSetting()
    return NextResponse.json({ data: settings })
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = crossSellSettingSchema.partial().refine(
        (d) => Object.keys(d).length > 0,
        { message: "至少需要修改一个字段" },
    ).safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const updated = await prisma.crossSellSetting.upsert({
        where: { id: "singleton" },
        update: parsed.data,
        create: {
            id: "singleton",
            enabled: parsed.data.enabled ?? true,
            discountPercent: parsed.data.discountPercent ?? 10,
            ttlMinutes: parsed.data.ttlMinutes ?? 30,
        },
    })

    return NextResponse.json({
        data: {
            enabled: updated.enabled,
            discountPercent: Number(updated.discountPercent),
            ttlMinutes: updated.ttlMinutes,
        },
    })
}
