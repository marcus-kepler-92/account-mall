import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/auth-guard"
import { unauthorized, invalidJsonBody, validationError } from "@/lib/api-response"
import { recipientPreviewSchema } from "@/lib/validations/email-marketing"
import { resolveRecipients, type ResolveInput } from "@/lib/email-marketing"

export const runtime = "nodejs"

type Params = Promise<{ id: string }>

export async function POST(request: NextRequest, { params: _params }: { params: Params }) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = recipientPreviewSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const emails = await resolveRecipients({
    type: parsed.data.recipientType,
    filter: parsed.data.recipientFilter,
  } as ResolveInput)

  return NextResponse.json({ count: emails.length })
}
