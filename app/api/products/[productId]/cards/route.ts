// app/api/products/[productId]/cards/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError, badRequest } from "@/lib/api-response"
import { revalidateCards } from "@/lib/revalidate-storefront"
import { bulkImportCardsSchema, bulkImportCards, getCardsByProduct, AutoFetchProductError } from "@/lib/domains/cards"
import type { CardStatus } from "@/lib/domains/cards"

type RouteContext = { params: Promise<{ productId: string }> }

const VALID_STATUSES = ["UNSOLD", "RESERVED", "SOLD", "DISABLED"] as const

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await context.params

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })
  if (!product) return notFound("Product not found")

  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get("status")
  const status = VALID_STATUSES.includes(rawStatus as CardStatus) ? (rawStatus as CardStatus) : null

  const data = await getCardsByProduct(productId, status)
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await context.params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, slug: true, price: true, productType: true },
  })
  if (!product) return notFound("Product not found")

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = bulkImportCardsSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  try {
    const result = await bulkImportCards(productId, { ...product, price: Number(product.price) }, parsed.data)
    revalidateCards()
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof AutoFetchProductError) return badRequest("自动获取类型的商品不支持手动导入卡密")
    if (e instanceof Error && e.message === "No valid card contents to import") return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
