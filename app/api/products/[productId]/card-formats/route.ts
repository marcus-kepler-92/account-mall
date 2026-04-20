import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { cardFormatSchema } from "@/lib/validations/card-format"

type RouteContext = { params: Promise<{ productId: string }> }

const FORMAT_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await params
  const formats = await prisma.productCardFormat.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(formats)
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId } = await params

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  })
  if (!product) return notFound("商品不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardFormatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const maxOrder = await prisma.productCardFormat.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  })
  const nextSort = (maxOrder._max.sortOrder ?? -1) + 1

  const format = await prisma.productCardFormat.create({
    data: {
      productId,
      name: parsed.data.name,
      template: parsed.data.template,
      sortOrder: nextSort,
    },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(format, { status: 201 })
}
