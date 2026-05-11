import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, badRequest, invalidJsonBody, validationError } from "@/lib/api-response"
import { productCrossSellUpdateSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ productId: string }> }

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const sourceProduct = await prisma.product.findUnique({ where: { id: productId } })
    if (!sourceProduct) return notFound("商品不存在")

    const bindings = await prisma.productCrossSell.findMany({
        where: { sourceProductId: productId },
        orderBy: { sortOrder: "asc" },
        include: {
            target: {
                select: { id: true, name: true, slug: true, image: true },
            },
        },
    })

    const data = bindings.map((b) => b.target)
    return NextResponse.json({ data })
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<NextResponse> {
    const session = await getAdminSession()
    if (!session) return unauthorized()

    const { productId } = await context.params

    const sourceProduct = await prisma.product.findUnique({ where: { id: productId } })
    if (!sourceProduct) return notFound("商品不存在")

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return invalidJsonBody()
    }

    const parsed = productCrossSellUpdateSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.flatten())

    const { targetProductIds } = parsed.data

    // Prevent self-referential binding
    if (targetProductIds.includes(productId)) {
        return badRequest("不能将商品自身设为推荐商品")
    }

    // Validate all target products exist
    if (targetProductIds.length > 0) {
        const existingTargets = await prisma.product.findMany({
            where: { id: { in: targetProductIds } },
            select: { id: true },
        })
        if (existingTargets.length !== targetProductIds.length) {
            return badRequest("推荐商品不存在")
        }
    }

    await prisma.$transaction([
        prisma.productCrossSell.deleteMany({ where: { sourceProductId: productId } }),
        ...targetProductIds.map((targetId, i) =>
            prisma.productCrossSell.create({
                data: { sourceProductId: productId, targetProductId: targetId, sortOrder: i },
            }),
        ),
    ])

    return NextResponse.json({ data: { count: targetProductIds.length } })
}
