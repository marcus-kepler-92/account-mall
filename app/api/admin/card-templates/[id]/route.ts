import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  invalidJsonBody,
  validationError,
  notFound,
  badRequest,
} from "@/lib/api-response"
import { cardTemplateSchema } from "@/lib/validations/card-template"

type RouteContext = { params: Promise<{ id: string }> }

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} as const

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  const existing = await prisma.cardTemplate.findUnique({ where: { id } })
  if (!existing) return notFound("模版不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const updated = await prisma.cardTemplate.update({
    where: { id },
    data: { name: parsed.data.name, template: parsed.data.template },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  const existing = await prisma.cardTemplate.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!existing) return notFound("模版不存在")

  if (existing._count.products > 0) {
    return badRequest("该模版已被商品使用，请先在商品中移除再删除")
  }

  await prisma.cardTemplate.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
