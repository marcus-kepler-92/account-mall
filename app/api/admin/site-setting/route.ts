import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { siteSettingPatchSchema } from "@/lib/validations/site-setting"
import { getSiteSettingRow, getSiteSettings } from "@/lib/site-settings"

export const runtime = "nodejs"

// GET returns BOTH the raw DB row (so the form knows which fields are still
// using env fallback vs explicitly overridden) and the materialized effective
// values (so the form can preview what users actually see right now).
export async function GET(): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const [row, effective] = await Promise.all([getSiteSettingRow(), getSiteSettings()])
    return NextResponse.json({
        data: {
            row: row ?? null,
            effective,
        },
    })
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

    const parsed = siteSettingPatchSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    if (Object.keys(parsed.data).length === 0) {
        return validationError({ formErrors: ["至少需要修改一个字段"], fieldErrors: {} })
    }

    const updated = await prisma.siteSetting.upsert({
        where: { id: "singleton" },
        update: parsed.data,
        create: { id: "singleton", ...parsed.data },
    })

    return NextResponse.json({ data: updated })
}
