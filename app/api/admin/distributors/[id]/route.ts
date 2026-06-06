import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest, validationError } from "@/lib/api-response"
import {
  updateDistributorSchema,
  updateDistributor,
  deleteDistributor,
  resetDistributorPassword,
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
  NoCredentialAccountError,
} from "@/lib/domains/distributors"

// Strict: an action mixed with update fields is ambiguous -> 400.
const resetPasswordActionSchema = z.object({
  action: z.literal("resetPassword"),
}).strict()

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  if (typeof body === "object" && body !== null && "action" in body) {
    const parsedAction = resetPasswordActionSchema.safeParse(body)
    if (!parsedAction.success) return validationError(parsedAction.error.flatten())
    try {
      const password = await resetDistributorPassword(id)
      return NextResponse.json({ password })
    } catch (e) {
      if (e instanceof DistributorNotFoundError) return notFound("分销员不存在")
      if (e instanceof NoCredentialAccountError) return notFound(e.message)
      throw e
    }
  }

  const parsed = updateDistributorSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  try {
    const user = await updateDistributor(id, parsed.data)
    return NextResponse.json(user)
  } catch (e) {
    if (e instanceof DistributorNotFoundError) return notFound(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  try {
    await deleteDistributor(id)
    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof DistributorNotFoundError) return notFound(e.message)
    if (e instanceof DistributorNotDisabledError) return badRequest(e.message)
    if (e instanceof DistributorHasAssociationsError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
