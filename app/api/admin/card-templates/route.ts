import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { cardTemplateSchema } from "@/lib/validations/card-template"

const TEMPLATE_SELECT = {
  id: true,
  name: true,
  template: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} as const

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const templates = await prisma.cardTemplate.findMany({
    orderBy: { sortOrder: "asc" },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = cardTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const maxOrder = await prisma.cardTemplate.aggregate({ _max: { sortOrder: true } })
  const nextSort = (maxOrder._max.sortOrder ?? -1) + 1

  const template = await prisma.cardTemplate.create({
    data: {
      name: parsed.data.name,
      template: parsed.data.template,
      sortOrder: nextSort,
    },
    select: TEMPLATE_SELECT,
  })
  return NextResponse.json(template, { status: 201 })
}
