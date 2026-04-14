import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, internalServerError } from "@/lib/api-response"

const schema = z.object({
  password: z.string().min(8, "密码至少 8 位"),
})

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const userId = (session.user as { id: string }).id

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const hashedPwd = await hashPassword(parsed.data.password)

  try {
    await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPwd },
    })
    await prisma.user.update({
      where: { id: userId },
      data: { mustChangePassword: false },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
