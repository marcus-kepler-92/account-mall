import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, conflict, invalidJsonBody, validationError } from "@/lib/api-response"
import { createCampaignSchema } from "@/lib/validations/email-marketing"

export const runtime = "nodejs"

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: { template: true },
  })
  if (!campaign) return notFound("活动不存在")

  return NextResponse.json(campaign)
}

export async function PATCH(_request: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const campaign = await prisma.emailCampaign.findUnique({ where: { id }, select: { status: true } })
  if (!campaign) return notFound("活动不存在")
  if (campaign.status !== "SENDING" && campaign.status !== "FAILED") {
    return conflict("只有发送中或失败状态的活动可以重置")
  }

  const updated = await prisma.emailCampaign.update({
    where: { id },
    data: { status: "DRAFT" },
  })
  return NextResponse.json(updated)
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!campaign) return notFound("活动不存在")
  if (campaign.status !== "DRAFT") return conflict("只有草稿状态的活动可以编辑")

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = createCampaignSchema.partial().safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { recipientFilter, ...rest } = parsed.data
  const updated = await prisma.emailCampaign.update({
    where: { id },
    data: {
      ...rest,
      ...(recipientFilter !== undefined
        ? { recipientFilter: recipientFilter as Prisma.InputJsonValue }
        : {}),
    },
  })

  return NextResponse.json(updated)
}
