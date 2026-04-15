import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { hashPassword } from "better-auth/crypto"
import { prisma } from "@/lib/prisma"
import { getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, badRequest, notFound, invalidJsonBody, validationError, internalServerError } from "@/lib/api-response"
import { ADMIN_ROLE_CONFIG, type AdminSubRole } from "@/lib/admin-role-config"
import { generatePassword } from "@/lib/password-utils"

const VALID_SUB_ROLES = Object.keys(ADMIN_ROLE_CONFIG) as AdminSubRole[]

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("updateRole"),
    adminRole: z.enum(VALID_SUB_ROLES as [AdminSubRole, ...AdminSubRole[]]).nullable(),
  }),
  z.object({
    action: z.literal("resetPassword"),
  }),
])

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params
  const callerId = (session.user as { id: string }).id

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  if (parsed.data.action === "updateRole") {
    if (id === callerId) return badRequest("不能修改自己的角色")

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, adminRole: true } })
    if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

    // Guard: prevent demoting the last super admin
    if (parsed.data.adminRole !== null && target.adminRole === null) {
      const superAdminCount = await prisma.user.count({ where: { role: "ADMIN", adminRole: null } })
      if (superAdminCount <= 1) return badRequest("不能降级最后一个超级管理员")
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { adminRole: parsed.data.adminRole },
      select: { id: true, email: true, name: true, adminRole: true },
    })
    return NextResponse.json(updated)
  }

  // resetPassword
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

  const password = generatePassword()
  const hashedPwd = await hashPassword(password)

  try {
    await prisma.$transaction(async (tx) => {
      const result = await tx.account.updateMany({
        where: { userId: id, providerId: "credential" },
        data: { password: hashedPwd },
      })
      if (result.count === 0) throw new Error("NO_CREDENTIAL_ACCOUNT")
      await tx.user.update({
        where: { id },
        data: { mustChangePassword: true },
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === "NO_CREDENTIAL_ACCOUNT") {
      return notFound("该管理员没有密码凭证")
    }
    return internalServerError()
  }
  return NextResponse.json({ password })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSuperAdminSession()
  if (!session) return unauthorized()

  const { id } = await context.params
  const callerId = (session.user as { id: string }).id

  if (id === callerId) return badRequest("不能删除自己的账号")

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, adminRole: true } })
  if (!target || target.role !== "ADMIN") return notFound("管理员不存在")

  // Guard: prevent deleting the last super admin
  if (target.adminRole === null) {
    const superAdminCount = await prisma.user.count({ where: { role: "ADMIN", adminRole: null } })
    if (superAdminCount <= 1) return badRequest("不能删除最后一个超级管理员")
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
