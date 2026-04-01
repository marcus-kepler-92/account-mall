import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"

import { createTemplateSchema } from "@/lib/validations/email-marketing"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      defaultSubject: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = createTemplateSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const template = await prisma.emailTemplate.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      defaultSubject: parsed.data.defaultSubject,
      unlayerDesign: parsed.data.unlayerDesign as Prisma.InputJsonValue,
      html: parsed.data.html,
    },
  })

  return NextResponse.json(template, { status: 201 })
}
