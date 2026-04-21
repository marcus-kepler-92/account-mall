import { NextRequest, NextResponse } from "next/server"
import { getDistributorSession } from "@/lib/auth-guard"
import { unauthorized, badRequest } from "@/lib/api-response"
import { bindInviterSchema, bindInviter, InviterCodeInvalidError, SelfInviterError } from "@/lib/domains/distributors"

export async function POST(request: NextRequest) {
  const session = await getDistributorSession()
  if (!session) return unauthorized()

  const user = session.user as { id: string }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 })
  }

  const parsed = bindInviterSchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors?.[0] ?? "参数错误"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    await bindInviter(user.id, parsed.data.inviteCode)
  } catch (err) {
    if (err instanceof InviterCodeInvalidError) {
      return badRequest("邀请码无效或邀请人已停用")
    }
    if (err instanceof SelfInviterError) {
      return badRequest("不能绑定自己为邀请人")
    }
    throw err
  }

  return NextResponse.json({ success: true })
}
