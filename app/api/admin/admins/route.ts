import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, conflict, invalidJsonBody, validationError } from "@/lib/api-response"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-role-config"
import { generatePassword } from "@/lib/password-utils"

const VALID_SUB_ROLES = Object.keys(ADMIN_ROLE_CONFIG) as AdminSubRole[]

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  adminRole: z.enum(VALID_SUB_ROLES as [AdminSubRole, ...AdminSubRole[]]).nullable(),
})

export async function GET() {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, username: true, name: true, adminRole: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return NextResponse.json(admins)
}

export async function POST(request: NextRequest) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { email, name, adminRole } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return conflict("该邮箱已被使用")

  const password = generatePassword()
  const hashedPwd = await hashPassword(password)
  const now = new Date()

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        name,
        emailVerified: true,
        role: "ADMIN",
        adminRole: adminRole ?? null,
        mustChangePassword: true,
        createdAt: now,
        updatedAt: now,
      },
    })
    await tx.account.create({
      data: {
        userId: u.id,
        accountId: u.id,
        providerId: "credential",
        password: hashedPwd,
        createdAt: now,
        updatedAt: now,
      },
    })
    return u
  })

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name, adminRole: user.adminRole, createdAt: user.createdAt },
      password,
    },
    { status: 201 }
  )
}

export const runtime = "nodejs"
