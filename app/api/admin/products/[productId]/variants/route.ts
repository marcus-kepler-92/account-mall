import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import {
    listVariants,
    createVariantForProduct,
    variantCreateSchema,
    NotManualProductError,
} from "@/lib/domains/variants"
import {
    unauthorized,
    invalidJsonBody,
    validationError,
    badRequest,
} from "@/lib/api-response"

type RouteContext = {
    params: Promise<{ productId: string }>
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const { productId } = await ctx.params
    const variants = await listVariants(productId)
    return NextResponse.json({ variants })
}

export async function POST(req: NextRequest, ctx: RouteContext) {
    const session = await getAdminSession()
    if (!session) return unauthorized()
    const { productId } = await ctx.params

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = variantCreateSchema.safeParse(body)
    if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors)
    }

    try {
        const created = await createVariantForProduct(productId, parsed.data)
        return NextResponse.json(created)
    } catch (err) {
        if (err instanceof NotManualProductError) return badRequest(err.message)
        throw err
    }
}

export const runtime = "nodejs"
