import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, invalidJsonBody, validationError } from "@/lib/api-response"

import { updateTemplateSchema } from "@/lib/validations/email-marketing"

export const runtime = "nodejs"

type Params = Promise<{ id: string }>

export async function GET(_: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const template = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!template) return notFound("Template not found")

  return NextResponse.json(template)
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = updateTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const existing = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!existing) return notFound("Template not found")

  const { unlayerDesign, ...rest } = parsed.data
  const updated = await prisma.emailTemplate.update({
    where: { id },
    data: {
      ...rest,
      ...(unlayerDesign !== undefined
        ? { unlayerDesign: unlayerDesign as Prisma.InputJsonValue }
        : {}),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const template = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!template) return notFound("Template not found")

  await prisma.emailTemplate.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
