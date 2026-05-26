import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import {
    updateVariantById,
    deleteVariantById,
    variantUpdateSchema,
    VariantNotFoundError,
    VariantHasOrdersError,
} from "@/lib/domains/variants"
import {
    unauthorized,
    invalidJsonBody,
    validationError,
    notFound,
    conflict,
} from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ productId: string; variantId: string }>
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const { variantId } = await ctx.params

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = variantUpdateSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    try {
        const updated = await updateVariantById(variantId, parsed.data)
        return NextResponse.json(updated)
    } catch (err) {
        if (err instanceof VariantNotFoundError) return notFound(err.message)
        throw err
    }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const { variantId } = await ctx.params

    try {
        await deleteVariantById(variantId)
        return NextResponse.json({ ok: true })
    } catch (err) {
        if (err instanceof VariantHasOrdersError) return conflict(err.message)
        if (err instanceof VariantNotFoundError) return notFound(err.message)
        throw err
    }
}

export const runtime = "nodejs"
