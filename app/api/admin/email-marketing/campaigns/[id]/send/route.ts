import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { config } from "@/lib/config"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, conflict } from "@/lib/api-response"
import { resolveRecipients, type ResolveInput } from "@/lib/email-marketing"

export const runtime = "nodejs"

type Params = Promise<{ id: string }>

const CHUNK_SIZE = 100

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export async function POST(_request: NextRequest, { params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { id } = await params
  const campaign = await prisma.emailCampaign.findUnique({ where: { id } })
  if (!campaign) return notFound("活动不存在")
  if (campaign.status !== "DRAFT") return conflict("只有草稿状态的活动可以发送")

  const emails = await resolveRecipients({
    type: campaign.recipientType,
    filter: campaign.recipientFilter,
  } as ResolveInput)

  if (emails.length === 0) {
    return NextResponse.json({ error: "没有符合条件的收件人" }, { status: 422 })
  }

  if (!config.resendApiKey) {
    return NextResponse.json({ error: "未配置 RESEND_API_KEY，无法发送邮件" }, { status: 503 })
  }

  await prisma.emailCampaign.update({
    where: { id },
    data: { status: "SENDING", recipientCount: emails.length },
  })

  let successCount = 0
  let failCount = 0

  try {
    const resend = new Resend(config.resendApiKey)
    const chunks = chunkArray(emails, CHUNK_SIZE)

    for (const chunk of chunks) {
      const messages = chunk.map((email) => ({
        from: config.emailFrom,
        to: email,
        subject: campaign.subject,
        html: campaign.html,
      }))

      const { data, error } = await resend.batch.send(messages)

      if (error || !data) {
        failCount += chunk.length
      } else {
        for (const result of data.data) {
          if (result.id) {
            successCount++
          } else {
            failCount++
          }
        }
      }
    }

    await prisma.emailCampaign.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), successCount, failCount },
    })

    return NextResponse.json({ successCount, failCount })
  } catch (err) {
    await prisma.emailCampaign.update({
      where: { id },
      data: { status: "FAILED" },
    })
    throw err
  }
}
