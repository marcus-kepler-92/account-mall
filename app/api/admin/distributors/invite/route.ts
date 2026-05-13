import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema, sendInvite, createNoEmailInviteLink } from "@/lib/domains/distributors"
import { config } from "@/lib/config"

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const admin = session.user as { id: string; name?: string }

  let body: unknown
  try { body = await request.json() } catch { return badRequest("Invalid JSON body") }

  const hasEmail =
    typeof body === "object" && body !== null && "email" in body &&
    typeof (body as { email: unknown }).email === "string" &&
    (body as { email: string }).email.length > 0

  if (!hasEmail) {
    const rawMaxUses = (body as { maxUses?: unknown }).maxUses
    const maxUses =
      typeof rawMaxUses === "number" && Number.isInteger(rawMaxUses)
        ? Math.max(1, Math.min(config.inviteLinkMaxCount, rawMaxUses))
        : config.inviteLinkDefaultCount
    const result = await createNoEmailInviteLink({ inviterId: admin.id, maxUses })
    return NextResponse.json({ success: true, link: result.link })
  }

  const parsed = distributorInviteSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors)

  const result = await sendInvite({
    email: parsed.data.email.toLowerCase(),
    inviterId: admin.id,
    inviterName: admin.name ?? "管理员",
  })
  if (!result.success) {
    return badRequest(result.reason === "already_registered" ? "该邮箱已注册，无需重复邀请" : "邮件发送失败，请稍后重试")
  }
  return NextResponse.json({ success: true, email: parsed.data.email })
}

export const runtime = "nodejs"
