import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { passwordSchema } from "@/lib/validations/auth"
import { prisma } from "@/lib/prisma"
import { getSessionForAdminArea } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError, internalServerError } from "@/lib/api-response"

const schema = z.object({
  password: passwordSchema,
})

export async function POST(request: NextRequest) {
  const result = await getSessionForAdminArea()
  if (!result || result.role !== "ADMIN") return unauthorized()

  const userId = (result.session.user as { id: string }).id

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const hashedPwd = await hashPassword(parsed.data.password)

  try {
    await prisma.$transaction([
      prisma.account.updateMany({
        where: { userId, providerId: "credential" },
        data: { password: hashedPwd },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { mustChangePassword: false },
      }),
    ])
    return NextResponse.json({ ok: true })
  } catch {
    return internalServerError()
  }
}

export const runtime = "nodejs"
