import { NextRequest, NextResponse } from "next/server"
import { badRequest, conflict, notFound, validationError } from "@/lib/api-response"
import {
  acceptInviteSchema,
  acceptNoEmailInviteSchema,
  acceptInvite,
  InviteTokenNotFoundError,
  InviteTokenExhaustedError,
  InviteTokenExpiredError,
  InviteTokenConcurrentAcceptError,
  UsernameConflictError,
  UsernameRequiredError,
  EmailAlreadyRegisteredError,
} from "@/lib/domains/distributors"
import { checkAcceptInviteRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  const rateLimitRes = await checkAcceptInviteRateLimit(request)
  if (rateLimitRes) return rateLimitRes

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON body")
  }

  const parsed = acceptInviteSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors)
  }

  const usernameResult = acceptNoEmailInviteSchema.safeParse(body)
  const username = usernameResult.success ? usernameResult.data.username : undefined

  try {
    await acceptInvite(parsed.data.token, { ...parsed.data, username })
  } catch (err) {
    if (err instanceof InviteTokenNotFoundError) return notFound("邀请链接无效")
    if (err instanceof InviteTokenExhaustedError) return badRequest("邀请名额已满，请联系邀请人重新生成链接", { code: "INVITE_EXHAUSTED" })
    if (err instanceof InviteTokenConcurrentAcceptError) return conflict("此邀请链接已被使用")
    if (err instanceof InviteTokenExpiredError) return badRequest("邀请链接已过期", { code: "INVITE_EXPIRED" })
    if (err instanceof UsernameRequiredError) return validationError({ username: ["用户名不能为空"] })
    if (err instanceof UsernameConflictError) return conflict("用户名已被使用，请换一个")
    if (err instanceof EmailAlreadyRegisteredError) return badRequest("该邮箱已注册")
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return conflict("注册冲突，请重试")
    }
    throw err
  }

  return NextResponse.json({ success: true })
}
