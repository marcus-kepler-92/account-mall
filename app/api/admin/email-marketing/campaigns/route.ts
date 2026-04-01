import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { createCampaignSchema } from "@/lib/validations/email-marketing"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const campaigns = await prisma.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      recipientType: true,
      recipientCount: true,
      successCount: true,
      failCount: true,
      sentAt: true,
      createdAt: true,
      template: {
        select: { id: true, title: true },
      },
    },
  })

  return NextResponse.json(campaigns)
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

  const parsed = createCampaignSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const campaign = await prisma.emailCampaign.create({
    data: {
      name: parsed.data.name,
      subject: parsed.data.subject,
      html: parsed.data.html,
      templateId: parsed.data.templateId ?? null,
      recipientType: parsed.data.recipientType,
      recipientFilter: parsed.data.recipientFilter as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json(campaign, { status: 201 })
}
