// app/api/cards/[cardId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, notFound, badRequest, invalidJsonBody, validationError } from "@/lib/api-response"
import {
  patchCardStatusSchema,
  patchCardStatus,
  deleteCard,
  CardNotFoundError,
  CardStatusTransitionError,
} from "@/lib/domains/cards"

type RouteContext = { params: Promise<{ cardId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { cardId } = await context.params

  let body: unknown
  try { body = await request.json() } catch { return invalidJsonBody() }

  const parsed = patchCardStatusSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  try {
    const result = await patchCardStatus(cardId, parsed.data)
    const message = result.status === "DISABLED" ? "Card disabled" : "Card enabled"
    return NextResponse.json({ message, ...result })
  } catch (e) {
    if (e instanceof CardNotFoundError) return notFound("Card not found")
    if (e instanceof CardStatusTransitionError) return badRequest(e.message)
    throw e
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { cardId } = await context.params

  try {
    await deleteCard(cardId)
    return NextResponse.json({ message: "Card deleted" })
  } catch (e) {
    if (e instanceof CardNotFoundError) return notFound("Card not found")
    if (e instanceof CardStatusTransitionError) return badRequest(e.message)
    throw e
  }
}

export const runtime = "nodejs"
