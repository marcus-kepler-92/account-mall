import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, notFound } from "@/lib/api-response"
import { cardFormatSchema } from "@/lib/validations/card-format"

type RouteContext = { params: Promise<{ productId: string; formatId: string }> }

const FORMAT_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId, formatId } = await params

  const existing = await prisma.productCardFormat.findFirst({
    where: { id: formatId, productId },
  })
  if (!existing) return notFound("格式不存在")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardFormatSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const updated = await prisma.productCardFormat.update({
    where: { id: formatId },
    data: { name: parsed.data.name, template: parsed.data.template },
    select: FORMAT_SELECT,
  })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { productId, formatId } = await params

  const existing = await prisma.productCardFormat.findFirst({
    where: { id: formatId, productId },
  })
  if (!existing) return notFound("格式不存在")

  await prisma.productCardFormat.delete({ where: { id: formatId } })
  return new NextResponse(null, { status: 204 })
}
