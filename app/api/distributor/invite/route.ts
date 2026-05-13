import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { badRequest, unauthorized, validationError } from "@/lib/api-response"
import { distributorInviteSchema, sendInvite, createNoEmailInviteLink } from "@/lib/domains/distributors"
import { config } from "@/lib/config"

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as { id: string; name?: string; disabledAt?: string | null }
  if (user.disabledAt) {
    return unauthorized("账号已停用，无法发送邀请")
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  // No-email invite: body has no email field
  const hasEmail =
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof (body as { email: unknown }).email === "string" &&
    (body as { email: string }).email.length > 0

  if (!hasEmail) {
    const rawMaxUses = (body as { maxUses?: unknown }).maxUses
    const maxUses =
      typeof rawMaxUses === "number" && Number.isInteger(rawMaxUses)
        ? Math.max(1, Math.min(config.inviteLinkMaxCount, rawMaxUses))
        : config.inviteLinkDefaultCount
    const result = await createNoEmailInviteLink({ inviterId: user.id, maxUses })
    return NextResponse.json({ success: true, link: result.link })
  }

  // Email invite: validate and send
  const parsed = distributorInviteSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const { email } = parsed.data

  const result = await sendInvite({
    email,
    inviterId: user.id,
    inviterName: user.name ?? "分销员",
  })

  if (!result.success) {
    if (result.reason === "already_registered") {
      return badRequest("该邮箱已注册，无需重复邀请")
    }
    return badRequest("邮件发送失败，请稍后重试")
  }

  return NextResponse.json({ success: true, email })
}
