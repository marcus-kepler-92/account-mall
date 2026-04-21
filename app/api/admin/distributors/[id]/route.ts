import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, notFound, badRequest } from "@/lib/api-response"
import {
  updateDistributorSchema,
  updateDistributor,
  deleteDistributor,
  DistributorNotFoundError,
  DistributorNotDisabledError,
  DistributorHasAssociationsError,
} from "@/lib/domains/distributors"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()
  const { id } = await context.params
  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }
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
