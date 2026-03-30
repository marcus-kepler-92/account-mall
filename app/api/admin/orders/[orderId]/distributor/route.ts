import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getAdminSession } from "@/lib/auth-guard"
import {
  unauthorized,
  notFound,
  invalidJsonBody,
  validationError,
  badRequest,
} from "@/lib/api-response"

const schema = z.object({
  distributorId: z.string().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getAdminSession()
  if (!session) return unauthorized()

  const { orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return invalidJsonBody()
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.flatten())

  const { distributorId } = parsed.data

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return notFound("Order not found")

  if (distributorId !== null) {
    const user = await prisma.user.findUnique({ where: { id: distributorId } })
    if (!user || user.role !== "DISTRIBUTOR") {
      return badRequest("Invalid distributor")
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { distributorId },
  })

  return NextResponse.json({ ok: true })
}

export const runtime = "nodejs"
