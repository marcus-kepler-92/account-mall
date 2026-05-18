// app/api/cards/batch/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession, getSuperAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { batchCardActionSchema, batchCardAction } from "@/lib/domains/cards"
import { revalidateCards } from "@/lib/revalidate-storefront"

export async function POST(request: NextRequest) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = batchCardActionSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  // DELETE requires super admin — auth check stays in route handler
  if (parsed.data.action === "DELETE") {
    const superSession = await getSuperAdminSession()
    if (!superSession) return unauthorized()
  }

  const result = await batchCardAction(parsed.data)
  revalidateCards()
  return NextResponse.json(result)
}

export const runtime = "nodejs"
